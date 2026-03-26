from flask import Flask, jsonify, request
from flask_cors import CORS
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
from datetime import datetime
import os
import uuid

app = Flask(__name__)
CORS(app)

# Configuration
INFLUX_URL = os.getenv('INFLUX_URL', 'http://YOUR_SERVER_IP:8086')
INFLUX_TOKEN = os.getenv('INFLUX_TOKEN', '')
INFLUX_ORG = os.getenv('INFLUX_ORG', 'homeassistant')
INFLUX_BUCKET = os.getenv('INFLUX_BUCKET', 'smoker')

# Initialize InfluxDB client
influx_client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
query_api = influx_client.query_api()
write_api = influx_client.write_api(write_options=SYNCHRONOUS)


@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'message': 'Smoker Tracker API is running'})


@app.route('/api/debug/setpoint-search', methods=['GET'])
def debug_setpoint_search():
    """Temporary debug endpoint to find setpoint entity in InfluxDB"""
    try:
        query = f'''
import "strings"

from(bucket: "{INFLUX_BUCKET}")
  |> range(start: -30d)
  |> filter(fn: (r) => strings.containsStr(v: r["entity_id"], substr: "set_temperature") or strings.containsStr(v: r["entity_id"], substr: "setpoint") or strings.containsStr(v: r["entity_id"], substr: "set_temp"))
  |> limit(n: 5)
        '''
        tables = query_api.query(query, org=INFLUX_ORG)
        results = []
        for table in tables:
            for record in table.records:
                results.append({
                    'entity_id': record.values.get('entity_id'),
                    'domain': record.values.get('domain'),
                    'measurement': record.get_measurement(),
                    'field': record.get_field(),
                    'value': str(record.get_value()),
                    'time': record.get_time().isoformat(),
                })
        return jsonify({'results': results})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/sessions', methods=['POST'])
def create_session():
    """Create a new smoke session"""
    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        meat_type = data.get('meatType', '').strip()
        notes = data.get('notes', '').strip()

        if not name:
            return jsonify({'error': 'name required'}), 400

        session_id = str(uuid.uuid4())
        now = datetime.utcnow()

        points = [
            Point("text")
                .tag("domain", "input_text")
                .tag("entity_id", "current_session_id")
                .tag("current_session_id", session_id)
                .field("state", session_id)
                .time(now),
            Point("text")
                .tag("domain", "input_text")
                .tag("entity_id", "smoke_session_name")
                .tag("current_session_id", session_id)
                .field("state", name)
                .time(now),
            Point("text")
                .tag("domain", "input_text")
                .tag("entity_id", "meat_type")
                .tag("current_session_id", session_id)
                .field("state", meat_type)
                .time(now),
            Point("text")
                .tag("domain", "input_text")
                .tag("entity_id", "smoke_session_notes")
                .tag("current_session_id", session_id)
                .field("state", notes)
                .time(now),
        ]

        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=points)

        now_iso = now.isoformat() + 'Z'
        return jsonify({
            'session': {
                'id': session_id,
                'name': name,
                'meatType': meat_type,
                'notes': notes,
                'startTime': now_iso,
                'endTime': None,
            }
        })

    except Exception as e:
        print(f"Error creating session: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/meat-types', methods=['GET'])
def get_meat_types():
    """Get the saved list of meat types"""
    try:
        meat_types = get_meat_types_list()
        return jsonify({'meatTypes': sorted(meat_types)})
    except Exception as e:
        print(f"Error fetching meat types: {e}")
        return jsonify({'meatTypes': []})


@app.route('/api/meat-types', methods=['POST'])
def add_meat_type():
    """Add a new meat type to the list"""
    try:
        data = request.get_json()
        name = data.get('name', '').strip()

        if not name:
            return jsonify({'error': 'name required'}), 400

        meat_types = get_meat_types_list()

        if name in meat_types:
            return jsonify({'success': True, 'message': 'Meat type already exists'})

        meat_types.append(name)

        point = Point("meat_type_list") \
            .tag("app", "smoker_tracker") \
            .field("types", ','.join(meat_types)) \
            .time(datetime.utcnow())

        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)

        return jsonify({'success': True, 'message': 'Meat type added'})

    except Exception as e:
        print(f"Error adding meat type: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/meat-types/<meat_type>', methods=['DELETE'])
def delete_meat_type(meat_type):
    """Remove a meat type from the list"""
    try:
        meat_types = get_meat_types_list()
        meat_type = meat_type.strip()

        if meat_type not in meat_types:
            return jsonify({'success': True, 'message': 'Meat type not found'})

        meat_types.remove(meat_type)

        point = Point("meat_type_list") \
            .tag("app", "smoker_tracker") \
            .field("types", ','.join(meat_types)) \
            .time(datetime.utcnow())

        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)

        return jsonify({'success': True, 'message': 'Meat type removed'})

    except Exception as e:
        print(f"Error deleting meat type: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/meat-types/<meat_type>', methods=['PUT'])
def rename_meat_type(meat_type):
    """Rename a meat type"""
    try:
        data = request.get_json()
        new_name = data.get('name', '').strip()

        if not new_name:
            return jsonify({'error': 'name required'}), 400

        meat_types = get_meat_types_list()
        meat_type = meat_type.strip()

        if meat_type not in meat_types:
            return jsonify({'error': 'Meat type not found'}), 404

        if new_name in meat_types:
            return jsonify({'error': 'A meat type with that name already exists'}), 400

        idx = meat_types.index(meat_type)
        meat_types[idx] = new_name

        point = Point("meat_type_list") \
            .tag("app", "smoker_tracker") \
            .field("types", ','.join(meat_types)) \
            .time(datetime.utcnow())

        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)

        return jsonify({'success': True, 'message': 'Meat type renamed'})

    except Exception as e:
        print(f"Error renaming meat type: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/sessions', methods=['GET'])
def get_sessions():
    """Get all smoke sessions. Use ?include_hidden=true to include hidden ones."""
    try:
        include_hidden = request.args.get('include_hidden', 'false').lower() == 'true'
        # Get hidden sessions first
        hidden_sessions = get_hidden_sessions_list()

        query = f'''
from(bucket: "{INFLUX_BUCKET}")
  |> range(start: -365d)
  |> filter(fn: (r) => r["domain"] == "input_text")
  |> filter(fn: (r) => r["_field"] == "state")
  |> filter(fn: (r) => r["entity_id"] == "current_session_id" or r["entity_id"] == "smoke_session_name" or r["entity_id"] == "meat_type" or r["entity_id"] == "smoke_session_notes")
        '''

        tables = query_api.query(query, org=INFLUX_ORG)

        all_data = []
        for table in tables:
            for record in table.records:
                all_data.append({
                    'time': record.get_time().isoformat(),
                    'sessionId': record.values.get('current_session_id'),
                    'name': record.values.get('smoke_session_name'),
                    'meatType': record.values.get('meat_type'),
                    'notes': record.values.get('smoke_session_notes'),
                    'entityId': record.values.get('entity_id'),
                    'value': record.get_value(),
                })

        # Fetch session end events
        end_query = f'''
from(bucket: "{INFLUX_BUCKET}")
  |> range(start: -365d)
  |> filter(fn: (r) => r["_measurement"] == "session_end")
  |> filter(fn: (r) => r["_field"] == "value")
        '''
        end_tables = query_api.query(end_query, org=INFLUX_ORG)
        ended_sessions = {}
        for table in end_tables:
            for record in table.records:
                sid = record.values.get('session_id')
                if sid:
                    ended_sessions[sid] = record.get_time().isoformat()

        # Process sessions
        sessions = process_sessions(all_data, hidden_sessions, include_hidden, ended_sessions)

        return jsonify({'sessions': sessions})

    except Exception as e:
        print(f"Error fetching sessions: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/sessions/<session_id>/temperatures', methods=['GET'])
def get_session_temperatures(session_id):
    """Get temperature data for a specific session"""
    try:
        start_time = request.args.get('start')
        end_time = request.args.get('end')
        
        if not start_time or not end_time:
            return jsonify({'error': 'start and end times required'}), 400

        query = f'''
from(bucket: "{INFLUX_BUCKET}")
  |> range(start: {start_time}, stop: {end_time})
  |> filter(fn: (r) => r["_measurement"] == "°F")
  |> filter(fn: (r) => r["_field"] == "value")
  |> filter(fn: (r) => r["domain"] == "sensor")
  |> filter(fn: (r) => r["entity_id"] == "esp32smoker_probe_1_temperature" or r["entity_id"] == "esp32smoker_probe_2_temperature" or r["entity_id"] == "esp32smoker_firepot_temperature" or r["entity_id"] == "esp32smoker_rtd_temperature")
  |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
        '''

        tables = query_api.query(query, org=INFLUX_ORG)
        
        data_by_probe = {}
        for table in tables:
            for record in table.records:
                entity_id = record.values.get('entity_id')
                probe_name = entity_id.replace('esp32smoker_', '').replace('_temperature', '')
                
                if probe_name not in data_by_probe:
                    data_by_probe[probe_name] = []
                
                data_by_probe[probe_name].append({
                    'time': record.get_time().isoformat(),
                    'value': round(record.get_value(), 1)
                })

        # Combine into single timeline
        time_map = {}
        for probe, data in data_by_probe.items():
            for point in data:
                time_key = point['time']
                if time_key not in time_map:
                    time_map[time_key] = {'time': time_key}
                time_map[time_key][probe] = point['value']

        combined = sorted(time_map.values(), key=lambda x: x['time'])
        
        return jsonify({'data': combined})
    
    except Exception as e:
        print(f"Error fetching temperatures: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/sessions/<session_id>', methods=['DELETE'])
def hide_session(session_id):
    """Hide a smoke session (doesn't delete data, just hides it from view)"""
    try:
        # Get current hidden sessions
        hidden_sessions = get_hidden_sessions_list()
        
        # Add new session to hidden list
        if session_id not in hidden_sessions:
            hidden_sessions.append(session_id)
        
        # Write updated hidden list to InfluxDB as a data point
        point = Point("hidden_sessions") \
            .tag("app", "smoker_tracker") \
            .field("session_ids", ','.join(hidden_sessions)) \
            .time(datetime.utcnow())
        
        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)
        
        return jsonify({'success': True, 'message': 'Session hidden'})
    
    except Exception as e:
        print(f"Error hiding session: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/hidden-sessions', methods=['GET'])
def get_hidden_sessions():
    """Get list of hidden session IDs"""
    try:
        hidden_list = get_hidden_sessions_list()
        return jsonify({'hiddenSessions': hidden_list})
    
    except Exception as e:
        print(f"Error fetching hidden sessions: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/hidden-sessions', methods=['DELETE'])
def unhide_all_sessions():
    """Unhide all sessions (clear the hidden list)"""
    try:
        # Write empty hidden list to InfluxDB
        point = Point("hidden_sessions") \
            .tag("app", "smoker_tracker") \
            .field("session_ids", '') \
            .time(datetime.utcnow())
        
        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)
        
        return jsonify({'success': True, 'message': 'All sessions unhidden'})
    
    except Exception as e:
        print(f"Error unhiding sessions: {e}")
        return jsonify({'error': str(e)}), 500
    

@app.route('/api/sessions/<session_id>/setpoints', methods=['GET'])
def get_session_setpoints(session_id):
    """Get temperature setpoint history for a session"""
    try:
        start_time = request.args.get('start')
        end_time = request.args.get('end')

        if not start_time or not end_time:
            return jsonify({'error': 'start and end times required'}), 400

        # Query for setpoint data — try both 'value' and 'state' fields
        # since HA InfluxDB integration may use either depending on entity type
        query = f'''
from(bucket: "{INFLUX_BUCKET}")
  |> range(start: {start_time}, stop: {end_time})
  |> filter(fn: (r) => r["entity_id"] == "number.esp32smoker_smoker_set_temperature")
  |> filter(fn: (r) => r["_field"] == "value" or r["_field"] == "state")
  |> sort(columns: ["_time"])
        '''

        tables = query_api.query(query, org=INFLUX_ORG)

        raw_points = []
        for table in tables:
            for record in table.records:
                val = record.get_value()
                # state field may be a string representation of a number
                if isinstance(val, str):
                    try:
                        val = float(val)
                    except ValueError:
                        continue
                raw_points.append({
                    'time': record.get_time().isoformat(),
                    'value': round(val, 1),
                })

        # Deduplicate: only keep points where the value changed
        setpoints = []
        for point in raw_points:
            if not setpoints or point['value'] != setpoints[-1]['value']:
                setpoints.append(point)

        return jsonify({'setpoints': setpoints})

    except Exception as e:
        print(f"Error fetching setpoints: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/sessions/<session_id>/restore', methods=['POST'])
def restore_session(session_id):
    """Unhide a single session"""
    try:
        hidden_sessions = get_hidden_sessions_list()

        if session_id not in hidden_sessions:
            return jsonify({'success': True, 'message': 'Session is not hidden'})

        hidden_sessions.remove(session_id)

        point = Point("hidden_sessions") \
            .tag("app", "smoker_tracker") \
            .field("session_ids", ','.join(hidden_sessions)) \
            .time(datetime.utcnow())

        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)

        return jsonify({'success': True, 'message': 'Session restored'})

    except Exception as e:
        print(f"Error restoring session: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/sessions/<session_id>/pauses', methods=['GET'])
def get_session_pauses(session_id):
    """Get all pause/resume events for a session"""
    try:
        query = f'''
from(bucket: "{INFLUX_BUCKET}")
  |> range(start: -365d)
  |> filter(fn: (r) => r["_measurement"] == "session_pauses")
  |> filter(fn: (r) => r["session_id"] == "{session_id}")
  |> filter(fn: (r) => r["_field"] == "value")
  |> sort(columns: ["_time"])
        '''

        tables = query_api.query(query, org=INFLUX_ORG)

        events = []
        for table in tables:
            for record in table.records:
                events.append({
                    'time': record.get_time().isoformat(),
                    'type': record.values.get('event_type'),
                })

        return jsonify({'pauses': events})

    except Exception as e:
        print(f"Error fetching pauses: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/sessions/<session_id>/pause', methods=['POST'])
def pause_session(session_id):
    """Record a pause event for a session"""
    try:
        point = Point("session_pauses") \
            .tag("session_id", session_id) \
            .tag("event_type", "pause") \
            .field("value", 1) \
            .time(datetime.utcnow())

        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)

        return jsonify({'success': True, 'message': 'Session paused'})

    except Exception as e:
        print(f"Error pausing session: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/sessions/<session_id>/resume', methods=['POST'])
def resume_session(session_id):
    """Record a resume event for a session"""
    try:
        point = Point("session_pauses") \
            .tag("session_id", session_id) \
            .tag("event_type", "resume") \
            .field("value", 1) \
            .time(datetime.utcnow())

        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)

        return jsonify({'success': True, 'message': 'Session resumed'})

    except Exception as e:
        print(f"Error resuming session: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/sessions/<session_id>/end', methods=['POST'])
def end_session(session_id):
    """End a smoke session by recording an end-time marker"""
    try:
        now = datetime.utcnow()

        point = Point("session_end") \
            .tag("session_id", session_id) \
            .field("value", 1) \
            .time(now)

        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)

        return jsonify({'success': True, 'endTime': now.isoformat() + 'Z'})

    except Exception as e:
        print(f"Error ending session: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/sessions/<session_id>/notes', methods=['PUT'])
def update_session_notes(session_id):
    """Update notes for a session via Home Assistant API"""
    try:
        data = request.get_json()
        notes = data.get('notes', '')
        
        if not notes:
            return jsonify({'error': 'notes required'}), 400
        
        # We need to update Home Assistant's input_text.smoke_session_notes
        # For this to work, we need to call HA API
        # Since we don't have HA_TOKEN by default, we'll write directly to InfluxDB
        
        # Write a new data point with the updated notes
        point = Point("text") \
            .tag("domain", "input_text") \
            .tag("entity_id", "smoke_session_notes") \
            .field("state", notes) \
            .field("value", notes) \
            .time(datetime.utcnow())
        
        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)
        
        return jsonify({'success': True, 'message': 'Notes updated'})
    
    except Exception as e:
        print(f"Error updating notes: {e}")
        return jsonify({'error': str(e)}), 500


def get_hidden_sessions_list():
    """Helper function to get the list of hidden session IDs from InfluxDB"""
    try:
        query = f'''
from(bucket: "{INFLUX_BUCKET}")
  |> range(start: -365d)
  |> filter(fn: (r) => r["_measurement"] == "hidden_sessions")
  |> filter(fn: (r) => r["_field"] == "session_ids")
  |> last()
        '''
        
        tables = query_api.query(query, org=INFLUX_ORG)
        
        for table in tables:
            for record in table.records:
                value = record.get_value()
                if value and value != '':
                    return [s.strip() for s in value.split(',') if s.strip()]
        
        return []
    
    except Exception as e:
        print(f"Error getting hidden sessions: {e}")
        return []


def get_meat_types_list():
    """Helper function to get the saved list of meat types from InfluxDB"""
    try:
        query = f'''
from(bucket: "{INFLUX_BUCKET}")
  |> range(start: -365d)
  |> filter(fn: (r) => r["_measurement"] == "meat_type_list")
  |> filter(fn: (r) => r["_field"] == "types")
  |> last()
        '''

        tables = query_api.query(query, org=INFLUX_ORG)

        for table in tables:
            for record in table.records:
                value = record.get_value()
                if value and value != '':
                    return [s.strip() for s in value.split(',') if s.strip()]

        return []

    except Exception as e:
        print(f"Error getting meat types list: {e}")
        return []


def process_sessions(all_data, hidden_sessions, include_hidden=False, ended_sessions=None):
    """Process raw data into sessions, optionally including hidden ones."""
    if ended_sessions is None:
        ended_sessions = {}
    session_map = {}

    for point in all_data:
        session_id = point.get('sessionId') or point.get('value')

        if not session_id or session_id == '':
            continue

        if session_id not in session_map:
            session_map[session_id] = {
                'id': session_id,
                'name': '',
                'meatType': '',
                'notes': '',
                'startTime': point['time'],
                'endTime': point['time'],
            }

        session = session_map[session_id]

        # Update metadata
        if point.get('entityId') == 'smoke_session_name' and point.get('value'):
            session['name'] = point['value']
        if point.get('entityId') == 'meat_type' and point.get('value'):
            session['meatType'] = point['value']
        if point.get('entityId') == 'smoke_session_notes' and point.get('value'):
            session['notes'] = point['value']

        # Update time range
        point_time = point['time']
        if point_time < session['startTime']:
            session['startTime'] = point_time
        if point_time > session['endTime']:
            session['endTime'] = point_time

    # Convert to list, filter hidden sessions, and set defaults
    sessions = []
    for session in session_map.values():
        is_hidden = session['id'] in hidden_sessions

        # Skip hidden sessions unless include_hidden is set
        if is_hidden and not include_hidden:
            continue

        end_time = ended_sessions.get(session['id'], None)

        sessions.append({
            'id': session['id'],
            'name': session['name'] or 'Unnamed Session',
            'meatType': session['meatType'] or 'N/A',
            'notes': session['notes'] or '',
            'startTime': session['startTime'],
            'endTime': end_time,
            'hidden': is_hidden,
        })

    # Sort by start time (newest first)
    sessions.sort(key=lambda x: x['startTime'], reverse=True)

    return sessions


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)