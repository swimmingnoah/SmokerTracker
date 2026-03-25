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
INFLUX_URL = os.getenv('INFLUX_URL', 'http://10.0.0.3:8086')
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
                'endTime': now_iso,
            }
        })

    except Exception as e:
        print(f"Error creating session: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/sessions', methods=['GET'])
def get_sessions():
    """Get all smoke sessions (excluding hidden ones)"""
    try:
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

        # Process sessions and filter out hidden ones
        sessions = process_sessions(all_data, hidden_sessions)
        
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


def process_sessions(all_data, hidden_sessions):
    """Process raw data into sessions and filter out hidden ones"""
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
        # Skip hidden sessions
        if session['id'] in hidden_sessions:
            continue
            
        sessions.append({
            'id': session['id'],
            'name': session['name'] or 'Unnamed Session',
            'meatType': session['meatType'] or 'N/A',
            'notes': session['notes'] or '',
            'startTime': session['startTime'],
            'endTime': session['endTime'],
        })

    # Sort by start time (newest first)
    sessions.sort(key=lambda x: x['startTime'], reverse=True)
    
    return sessions


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)