from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
from datetime import datetime, timedelta
from functools import wraps
from werkzeug.utils import secure_filename
import os
import re
import uuid

app = Flask(__name__)

# CORS: only allow specified origins (for local dev). In production behind
# nginx, requests are same-origin so CORS headers are not needed.
ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', '').strip()
if ALLOWED_ORIGINS:
    CORS(app, resources={r"/api/*": {"origins": ALLOWED_ORIGINS.split(',')}})

# Configuration
INFLUX_URL = os.getenv('INFLUX_URL', 'http://YOUR_SERVER_IP:8086')
INFLUX_TOKEN = os.getenv('INFLUX_TOKEN', '')
INFLUX_ORG = os.getenv('INFLUX_ORG', 'homeassistant')
INFLUX_BUCKET = os.getenv('INFLUX_BUCKET', 'smoker')
API_KEY = os.getenv('API_KEY', '')

# Initialize InfluxDB client
influx_client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
query_api = influx_client.query_api()
write_api = influx_client.write_api(write_options=SYNCHRONOUS)

# --- Input validation ---

MAX_NAME_LENGTH = 255
MAX_NOTES_LENGTH = 5000
MAX_MEAT_TYPE_LENGTH = 100
MAX_URL_LENGTH = 2048

# Photo upload config
UPLOAD_DIR = os.getenv('UPLOAD_DIR', '/app/uploads/photos')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
MAX_PHOTO_SIZE = 10 * 1024 * 1024  # 10MB
MAX_PHOTOS_PER_SESSION = 20

os.makedirs(UPLOAD_DIR, exist_ok=True)

# ISO 8601 timestamp pattern
ISO_TIMESTAMP_RE = re.compile(
    r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$'
)

# UUID pattern (also allow legacy session IDs like smoke_YYYYMMDD_HHMMSS)
SESSION_ID_RE = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^smoke_\d{8}_\d{6}$'
)


def validate_timestamp(ts):
    """Validate that a string is a proper ISO 8601 timestamp."""
    return bool(ts and ISO_TIMESTAMP_RE.match(ts))


def validate_session_id(sid):
    """Validate that a session ID matches expected format."""
    return bool(sid and SESSION_ID_RE.match(sid))


def safe_error(message, status_code=500):
    """Return a generic error response without leaking internals."""
    return jsonify({'error': message}), status_code


# --- API key authentication ---

def require_api_key(f):
    """Decorator to require API key on mutating endpoints."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not API_KEY:
            # No API key configured — skip auth (local dev)
            return f(*args, **kwargs)
        key = request.headers.get('X-API-Key', '')
        if key != API_KEY:
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated


# --- Endpoints ---

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'message': 'Smoker Tracker API is running'})


@app.route('/api/auth/status', methods=['GET'])
def auth_status():
    """Check if authentication is required"""
    return jsonify({'authRequired': bool(API_KEY)})


@app.route('/api/auth/verify', methods=['POST'])
def auth_verify():
    """Verify an API key"""
    if not API_KEY:
        return jsonify({'valid': True})
    data = request.get_json()
    key = (data or {}).get('key', '')
    if key == API_KEY:
        return jsonify({'valid': True})
    return jsonify({'valid': False}), 401


@app.route('/api/sessions', methods=['POST'])
@require_api_key
def create_session():
    """Create a new smoke session"""
    try:
        data = request.get_json()
        if not data:
            return safe_error('Invalid request body', 400)

        name = data.get('name', '').strip()[:MAX_NAME_LENGTH]
        meat_type = data.get('meatType', '').strip()[:MAX_MEAT_TYPE_LENGTH]
        notes = data.get('notes', '').strip()[:MAX_NOTES_LENGTH]
        recipe_url = data.get('recipeUrl', '').strip()[:MAX_URL_LENGTH]
        spices = data.get('spices', '').strip()[:MAX_NOTES_LENGTH]
        weight = data.get('weight', '').strip()[:MAX_MEAT_TYPE_LENGTH]

        if not name:
            return safe_error('name required', 400)

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

        if recipe_url:
            points.append(
                Point("text")
                    .tag("domain", "input_text")
                    .tag("entity_id", "smoke_session_recipe_url")
                    .tag("current_session_id", session_id)
                    .field("state", recipe_url)
                    .time(now)
            )

        if spices:
            points.append(
                Point("text")
                    .tag("domain", "input_text")
                    .tag("entity_id", "smoke_session_spices")
                    .tag("current_session_id", session_id)
                    .field("state", spices)
                    .time(now)
            )

        if weight:
            points.append(
                Point("text")
                    .tag("domain", "input_text")
                    .tag("entity_id", "smoke_session_weight")
                    .tag("current_session_id", session_id)
                    .field("state", weight)
                    .time(now)
            )

        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=points)

        now_iso = now.isoformat() + 'Z'
        return jsonify({
            'session': {
                'id': session_id,
                'name': name,
                'meatType': meat_type,
                'notes': notes,
                'recipeUrl': recipe_url,
                'spices': spices,
                'weight': weight,
                'startTime': now_iso,
                'endTime': None,
            }
        })

    except Exception as e:
        print(f"Error creating session: {e}")
        return safe_error('Failed to create session')


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
@require_api_key
def add_meat_type():
    """Add a new meat type to the list"""
    try:
        data = request.get_json()
        if not data:
            return safe_error('Invalid request body', 400)

        name = data.get('name', '').strip()[:MAX_MEAT_TYPE_LENGTH]

        if not name:
            return safe_error('name required', 400)

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
        return safe_error('Failed to add meat type')


@app.route('/api/meat-types/<meat_type>', methods=['DELETE'])
@require_api_key
def delete_meat_type(meat_type):
    """Remove a meat type from the list"""
    try:
        meat_types = get_meat_types_list()
        meat_type = meat_type.strip()[:MAX_MEAT_TYPE_LENGTH]

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
        return safe_error('Failed to delete meat type')


@app.route('/api/meat-types/<meat_type>', methods=['PUT'])
@require_api_key
def rename_meat_type(meat_type):
    """Rename a meat type"""
    try:
        data = request.get_json()
        if not data:
            return safe_error('Invalid request body', 400)

        new_name = data.get('name', '').strip()[:MAX_MEAT_TYPE_LENGTH]

        if not new_name:
            return safe_error('name required', 400)

        meat_types = get_meat_types_list()
        meat_type = meat_type.strip()[:MAX_MEAT_TYPE_LENGTH]

        if meat_type not in meat_types:
            return safe_error('Meat type not found', 404)

        if new_name in meat_types:
            return safe_error('A meat type with that name already exists', 400)

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
        return safe_error('Failed to rename meat type')


@app.route('/api/spices', methods=['GET'])
def get_spices():
    """Get the saved list of spices/rubs"""
    try:
        spices = get_spices_list()
        return jsonify({'spices': sorted(spices)})
    except Exception as e:
        print(f"Error fetching spices: {e}")
        return jsonify({'spices': []})


@app.route('/api/spices', methods=['POST'])
@require_api_key
def add_spice():
    """Add a new spice to the saved list"""
    try:
        data = request.get_json()
        if not data:
            return safe_error('Invalid request body', 400)

        name = data.get('name', '').strip().replace(',', '')[:MAX_MEAT_TYPE_LENGTH]

        if not name:
            return safe_error('name required', 400)

        spices = get_spices_list()

        if name in spices:
            return jsonify({'success': True, 'message': 'Spice already exists'})

        spices.append(name)

        point = Point("spice_list") \
            .tag("app", "smoker_tracker") \
            .field("spices", ','.join(spices)) \
            .time(datetime.utcnow())

        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)

        return jsonify({'success': True, 'message': 'Spice added'})

    except Exception as e:
        print(f"Error adding spice: {e}")
        return safe_error('Failed to add spice')


@app.route('/api/spices/<spice>', methods=['DELETE'])
@require_api_key
def delete_spice(spice):
    """Remove a spice from the saved list"""
    try:
        spices = get_spices_list()
        spice = spice.strip()[:MAX_MEAT_TYPE_LENGTH]

        if spice not in spices:
            return jsonify({'success': True, 'message': 'Spice not found'})

        spices.remove(spice)

        point = Point("spice_list") \
            .tag("app", "smoker_tracker") \
            .field("spices", ','.join(spices)) \
            .time(datetime.utcnow())

        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)

        return jsonify({'success': True, 'message': 'Spice removed'})

    except Exception as e:
        print(f"Error deleting spice: {e}")
        return safe_error('Failed to delete spice')


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
  |> filter(fn: (r) => r["entity_id"] == "current_session_id" or r["entity_id"] == "smoke_session_name" or r["entity_id"] == "meat_type" or r["entity_id"] == "smoke_session_notes" or r["entity_id"] == "smoke_session_recipe_url" or r["entity_id"] == "smoke_session_spices" or r["entity_id"] == "smoke_session_weight")
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
                    t = record.get_time().isoformat()
                    # Use the earliest session_end per session
                    if sid not in ended_sessions or t < ended_sessions[sid]:
                        ended_sessions[sid] = t

        # Process sessions
        sessions = process_sessions(all_data, hidden_sessions, include_hidden, ended_sessions)

        return jsonify({'sessions': sessions})

    except Exception as e:
        print(f"Error fetching sessions: {e}")
        return safe_error('Failed to fetch sessions')


@app.route('/api/sessions/<session_id>/temperatures', methods=['GET'])
def get_session_temperatures(session_id):
    """Get temperature data for a specific session"""
    try:
        if not validate_session_id(session_id):
            return safe_error('Invalid session ID', 400)

        start_time = request.args.get('start')
        end_time = request.args.get('end')

        if not validate_timestamp(start_time) or not validate_timestamp(end_time):
            return safe_error('Invalid timestamp format', 400)

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
        return safe_error('Failed to fetch temperature data')


@app.route('/api/sessions/<session_id>', methods=['DELETE'])
@require_api_key
def hide_session(session_id):
    """Hide a smoke session (doesn't delete data, just hides it from view)"""
    try:
        if not validate_session_id(session_id):
            return safe_error('Invalid session ID', 400)

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
        return safe_error('Failed to hide session')


@app.route('/api/hidden-sessions', methods=['GET'])
def get_hidden_sessions():
    """Get list of hidden session IDs"""
    try:
        hidden_list = get_hidden_sessions_list()
        return jsonify({'hiddenSessions': hidden_list})

    except Exception as e:
        print(f"Error fetching hidden sessions: {e}")
        return safe_error('Failed to fetch hidden sessions')


@app.route('/api/hidden-sessions', methods=['DELETE'])
@require_api_key
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
        return safe_error('Failed to unhide sessions')


@app.route('/api/sessions/<session_id>/setpoints', methods=['GET'])
def get_session_setpoints(session_id):
    """Get temperature setpoint history for a session"""
    try:
        if not validate_session_id(session_id):
            return safe_error('Invalid session ID', 400)

        start_time = request.args.get('start')
        end_time = request.args.get('end')

        if not validate_timestamp(start_time) or not validate_timestamp(end_time):
            return safe_error('Invalid timestamp format', 400)

        query = f'''
from(bucket: "{INFLUX_BUCKET}")
  |> range(start: {start_time}, stop: {end_time})
  |> filter(fn: (r) => r["entity_id"] == "esp32smoker_smoker_set_temperature")
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

        # Look back for the setpoint in effect at session start, in case the
        # user set it before the session began and never touched it.
        initial_query = f'''
from(bucket: "{INFLUX_BUCKET}")
  |> range(start: -90d, stop: {start_time})
  |> filter(fn: (r) => r["entity_id"] == "esp32smoker_smoker_set_temperature")
  |> filter(fn: (r) => r["_field"] == "value" or r["_field"] == "state")
  |> last()
        '''

        initial_tables = query_api.query(initial_query, org=INFLUX_ORG)
        initial_value = None
        initial_time = None
        for table in initial_tables:
            for record in table.records:
                val = record.get_value()
                if isinstance(val, str):
                    try:
                        val = float(val)
                    except ValueError:
                        continue
                rec_time = record.get_time()
                if initial_time is None or rec_time > initial_time:
                    initial_time = rec_time
                    initial_value = val

        if initial_value is not None:
            raw_points.insert(0, {
                'time': start_time,
                'value': round(initial_value, 1),
            })

        # Deduplicate: only keep points where the value changed
        setpoints = []
        for point in raw_points:
            if not setpoints or point['value'] != setpoints[-1]['value']:
                setpoints.append(point)

        return jsonify({'setpoints': setpoints})

    except Exception as e:
        print(f"Error fetching setpoints: {e}")
        return safe_error('Failed to fetch setpoints')


@app.route('/api/sessions/<session_id>/restore', methods=['POST'])
@require_api_key
def restore_session(session_id):
    """Unhide a single session"""
    try:
        if not validate_session_id(session_id):
            return safe_error('Invalid session ID', 400)

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
        return safe_error('Failed to restore session')


@app.route('/api/sessions/<session_id>/pauses', methods=['GET'])
def get_session_pauses(session_id):
    """Get all pause/resume events for a session"""
    try:
        if not validate_session_id(session_id):
            return safe_error('Invalid session ID', 400)

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

        # Sort across tables since pause/resume come from different series
        events.sort(key=lambda e: e['time'])

        return jsonify({'pauses': events})

    except Exception as e:
        print(f"Error fetching pauses: {e}")
        return safe_error('Failed to fetch pause events')


@app.route('/api/sessions/<session_id>/pause', methods=['POST'])
@require_api_key
def pause_session(session_id):
    """Record a pause event for a session"""
    try:
        if not validate_session_id(session_id):
            return safe_error('Invalid session ID', 400)

        point = Point("session_pauses") \
            .tag("session_id", session_id) \
            .tag("event_type", "pause") \
            .field("value", 1) \
            .time(datetime.utcnow())

        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)

        return jsonify({'success': True, 'message': 'Session paused'})

    except Exception as e:
        print(f"Error pausing session: {e}")
        return safe_error('Failed to pause session')


@app.route('/api/sessions/<session_id>/resume', methods=['POST'])
@require_api_key
def resume_session(session_id):
    """Record a resume event for a session"""
    try:
        if not validate_session_id(session_id):
            return safe_error('Invalid session ID', 400)

        point = Point("session_pauses") \
            .tag("session_id", session_id) \
            .tag("event_type", "resume") \
            .field("value", 1) \
            .time(datetime.utcnow())

        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)

        return jsonify({'success': True, 'message': 'Session resumed'})

    except Exception as e:
        print(f"Error resuming session: {e}")
        return safe_error('Failed to resume session')


@app.route('/api/sessions/<session_id>/pauses/<int:pause_index>', methods=['PUT'])
@require_api_key
def update_pause_event(session_id, pause_index):
    """Update the time of a pause/resume event"""
    try:
        if not validate_session_id(session_id):
            return safe_error('Invalid session ID', 400)

        data = request.get_json()
        if not data:
            return safe_error('Invalid request body', 400)

        new_time_str = data.get('time', '').strip()
        if not validate_timestamp(new_time_str):
            return safe_error('Invalid timestamp format', 400)

        new_time = datetime.fromisoformat(new_time_str.replace('Z', '+00:00'))

        # Fetch all pause events for this session to find the one at the given index
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
                    'time': record.get_time(),
                    'type': record.values.get('event_type'),
                })
        events.sort(key=lambda e: e['time'])

        if pause_index < 0 or pause_index >= len(events):
            return safe_error('Pause event not found', 404)

        old_event = events[pause_index]

        # Delete old point using InfluxDB delete API
        delete_api = influx_client.delete_api()
        old_time = old_event['time']
        # Delete within a 1ms window around the exact timestamp
        start_del = old_time - timedelta(milliseconds=1)
        stop_del = old_time + timedelta(milliseconds=1)
        predicate = f'_measurement="session_pauses" AND session_id="{session_id}" AND event_type="{old_event["type"]}"'
        delete_api.delete(start_del, stop_del, predicate, bucket=INFLUX_BUCKET, org=INFLUX_ORG)

        # Write new point at the updated time
        point = Point("session_pauses") \
            .tag("session_id", session_id) \
            .tag("event_type", old_event['type']) \
            .field("value", 1) \
            .time(new_time)

        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)

        return jsonify({'success': True, 'message': 'Pause event updated'})

    except Exception as e:
        print(f"Error updating pause event: {e}")
        return safe_error('Failed to update pause event')


@app.route('/api/sessions/<session_id>/end', methods=['POST'])
@require_api_key
def end_session(session_id):
    """End a smoke session by recording an end-time marker"""
    try:
        if not validate_session_id(session_id):
            return safe_error('Invalid session ID', 400)

        data = request.get_json(silent=True) or {}
        end_time_str = data.get('endTime')
        if end_time_str and validate_timestamp(end_time_str):
            now = datetime.fromisoformat(end_time_str.replace('Z', '+00:00'))
        else:
            now = datetime.utcnow()

        point = Point("session_end") \
            .tag("session_id", session_id) \
            .field("value", 1) \
            .time(now)

        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)

        return jsonify({'success': True, 'endTime': now.isoformat() + 'Z'})

    except Exception as e:
        print(f"Error ending session: {e}")
        return safe_error('Failed to end session')


@app.route('/api/sessions/<session_id>', methods=['PUT'])
@require_api_key
def update_session(session_id):
    """Update session fields (name, meatType, notes)"""
    try:
        if not validate_session_id(session_id):
            return safe_error('Invalid session ID', 400)

        data = request.get_json()
        if not data:
            return safe_error('Invalid request body', 400)

        now = datetime.utcnow()
        points = []

        if 'name' in data:
            name = data['name'].strip()[:MAX_NAME_LENGTH]
            points.append(
                Point("text")
                    .tag("domain", "input_text")
                    .tag("entity_id", "smoke_session_name")
                    .tag("current_session_id", session_id)
                    .field("state", name)
                    .time(now)
            )

        if 'meatType' in data:
            meat_type = data['meatType'].strip()[:MAX_MEAT_TYPE_LENGTH]
            points.append(
                Point("text")
                    .tag("domain", "input_text")
                    .tag("entity_id", "meat_type")
                    .tag("current_session_id", session_id)
                    .field("state", meat_type)
                    .time(now)
            )

        if 'notes' in data:
            notes = data['notes'].strip()[:MAX_NOTES_LENGTH]
            points.append(
                Point("text")
                    .tag("domain", "input_text")
                    .tag("entity_id", "smoke_session_notes")
                    .tag("current_session_id", session_id)
                    .field("state", notes)
                    .time(now)
            )

        if 'recipeUrl' in data:
            recipe_url = data['recipeUrl'].strip()[:MAX_URL_LENGTH]
            points.append(
                Point("text")
                    .tag("domain", "input_text")
                    .tag("entity_id", "smoke_session_recipe_url")
                    .tag("current_session_id", session_id)
                    .field("state", recipe_url)
                    .time(now)
            )

        if 'spices' in data:
            spices = data['spices'].strip()[:MAX_NOTES_LENGTH]
            points.append(
                Point("text")
                    .tag("domain", "input_text")
                    .tag("entity_id", "smoke_session_spices")
                    .tag("current_session_id", session_id)
                    .field("state", spices)
                    .time(now)
            )

        if 'weight' in data:
            weight = data['weight'].strip()[:MAX_MEAT_TYPE_LENGTH]
            points.append(
                Point("text")
                    .tag("domain", "input_text")
                    .tag("entity_id", "smoke_session_weight")
                    .tag("current_session_id", session_id)
                    .field("state", weight)
                    .time(now)
            )

        if points:
            write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=points)

        return jsonify({'success': True, 'message': 'Session updated'})

    except Exception as e:
        print(f"Error updating session: {e}")
        return safe_error('Failed to update session')


@app.route('/api/sessions/<session_id>/notes', methods=['PUT'])
@require_api_key
def update_session_notes(session_id):
    """Update notes for a session"""
    try:
        if not validate_session_id(session_id):
            return safe_error('Invalid session ID', 400)

        data = request.get_json()
        if not data:
            return safe_error('Invalid request body', 400)

        notes = data.get('notes', '').strip()[:MAX_NOTES_LENGTH]

        if not notes:
            return safe_error('notes required', 400)

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
        return safe_error('Failed to update notes')


@app.route('/api/sessions/<session_id>/hidden-setpoints', methods=['GET'])
def get_hidden_setpoints(session_id):
    """Get hidden setpoint timestamps for a session"""
    try:
        if not validate_session_id(session_id):
            return safe_error('Invalid session ID', 400)

        hidden = get_hidden_setpoints_list(session_id)
        return jsonify({'hiddenSetpoints': hidden})

    except Exception as e:
        print(f"Error fetching hidden setpoints: {e}")
        return jsonify({'hiddenSetpoints': []})


@app.route('/api/sessions/<session_id>/hidden-setpoints', methods=['PUT'])
@require_api_key
def update_hidden_setpoints(session_id):
    """Update the list of hidden setpoint timestamps for a session"""
    try:
        if not validate_session_id(session_id):
            return safe_error('Invalid session ID', 400)

        data = request.get_json()
        if not data:
            return safe_error('Invalid request body', 400)

        timestamps = data.get('timestamps', [])
        if not isinstance(timestamps, list):
            return safe_error('timestamps must be a list', 400)

        # Validate all timestamps
        for ts in timestamps:
            if not isinstance(ts, str):
                return safe_error('Each timestamp must be a string', 400)

        point = Point("hidden_setpoints") \
            .tag("session_id", session_id) \
            .field("timestamps", ','.join(timestamps)) \
            .time(datetime.utcnow())

        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)

        return jsonify({'success': True})

    except Exception as e:
        print(f"Error updating hidden setpoints: {e}")
        return safe_error('Failed to update hidden setpoints')


@app.route('/api/sessions/<session_id>/probe-settings', methods=['GET'])
def get_probe_settings(session_id):
    """Get per-session probe settings (hidden probes, custom names)"""
    try:
        if not validate_session_id(session_id):
            return safe_error('Invalid session ID', 400)

        hidden = get_session_setting(session_id, 'hidden_probes')
        names = get_session_setting(session_id, 'probe_names')

        hidden_list = [s.strip() for s in hidden.split(',') if s.strip()] if hidden else []
        names_map = {}
        if names:
            for pair in names.split('|'):
                if ':' in pair:
                    key, val = pair.split(':', 1)
                    names_map[key.strip()] = val.strip()

        return jsonify({'hiddenProbes': hidden_list, 'probeNames': names_map})

    except Exception as e:
        print(f"Error fetching probe settings: {e}")
        return safe_error('Failed to fetch probe settings')


@app.route('/api/sessions/<session_id>/probe-settings', methods=['PUT'])
@require_api_key
def update_probe_settings(session_id):
    """Update per-session probe settings"""
    try:
        if not validate_session_id(session_id):
            return safe_error('Invalid session ID', 400)

        data = request.get_json()
        if not data:
            return safe_error('Invalid request body', 400)

        now = datetime.utcnow()
        points = []

        if 'hiddenProbes' in data:
            hidden_list = data['hiddenProbes']
            if not isinstance(hidden_list, list):
                return safe_error('hiddenProbes must be a list', 400)
            point = Point("session_probe_settings") \
                .tag("session_id", session_id) \
                .tag("setting", "hidden_probes") \
                .field("value", ','.join(hidden_list)) \
                .time(now)
            points.append(point)

        if 'probeNames' in data:
            names_map = data['probeNames']
            if not isinstance(names_map, dict):
                return safe_error('probeNames must be an object', 400)
            encoded = '|'.join(f"{k}:{v}" for k, v in names_map.items())
            point = Point("session_probe_settings") \
                .tag("session_id", session_id) \
                .tag("setting", "probe_names") \
                .field("value", encoded) \
                .time(now)
            points.append(point)

        if points:
            write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=points)

        return jsonify({'success': True})

    except Exception as e:
        print(f"Error updating probe settings: {e}")
        return safe_error('Failed to update probe settings')


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/api/sessions/<session_id>/photos', methods=['GET'])
def get_session_photos(session_id):
    """List photos for a session"""
    try:
        if not validate_session_id(session_id):
            return safe_error('Invalid session ID', 400)

        session_dir = os.path.join(UPLOAD_DIR, session_id)
        if not os.path.exists(session_dir):
            return jsonify({'photos': []})

        photos = []
        for filename in sorted(os.listdir(session_dir)):
            if allowed_file(filename):
                photos.append({
                    'filename': filename,
                    'url': f'/api/sessions/{session_id}/photos/{filename}',
                })

        return jsonify({'photos': photos})

    except Exception as e:
        print(f"Error listing photos: {e}")
        return safe_error('Failed to list photos')


@app.route('/api/sessions/<session_id>/photos/<filename>', methods=['GET'])
def serve_photo(session_id, filename):
    """Serve a photo file"""
    if not validate_session_id(session_id):
        return safe_error('Invalid session ID', 400)

    safe_name = secure_filename(filename)
    session_dir = os.path.join(UPLOAD_DIR, session_id)
    return send_from_directory(session_dir, safe_name)


@app.route('/api/sessions/<session_id>/photos', methods=['POST'])
@require_api_key
def upload_photo(session_id):
    """Upload a photo for a session"""
    try:
        if not validate_session_id(session_id):
            return safe_error('Invalid session ID', 400)

        if 'photo' not in request.files:
            return safe_error('No photo file provided', 400)

        file = request.files['photo']
        if file.filename == '':
            return safe_error('No file selected', 400)

        if not allowed_file(file.filename):
            return safe_error('File type not allowed. Use: png, jpg, jpeg, gif, webp', 400)

        # Check file size
        file.seek(0, 2)
        size = file.tell()
        file.seek(0)
        if size > MAX_PHOTO_SIZE:
            return safe_error('File too large. Maximum 10MB', 400)

        # Check photo count
        session_dir = os.path.join(UPLOAD_DIR, session_id)
        os.makedirs(session_dir, exist_ok=True)
        existing = [f for f in os.listdir(session_dir) if allowed_file(f)] if os.path.exists(session_dir) else []
        if len(existing) >= MAX_PHOTOS_PER_SESSION:
            return safe_error(f'Maximum {MAX_PHOTOS_PER_SESSION} photos per session', 400)

        ext = file.filename.rsplit('.', 1)[1].lower()
        filename = f"{uuid.uuid4()}.{ext}"
        filepath = os.path.join(session_dir, filename)
        file.save(filepath)

        return jsonify({
            'success': True,
            'photo': {
                'filename': filename,
                'url': f'/api/sessions/{session_id}/photos/{filename}',
            }
        })

    except Exception as e:
        print(f"Error uploading photo: {e}")
        return safe_error('Failed to upload photo')


@app.route('/api/sessions/<session_id>/photos/<filename>', methods=['DELETE'])
@require_api_key
def delete_photo(session_id, filename):
    """Delete a photo"""
    try:
        if not validate_session_id(session_id):
            return safe_error('Invalid session ID', 400)

        safe_name = secure_filename(filename)
        filepath = os.path.join(UPLOAD_DIR, session_id, safe_name)

        if not os.path.exists(filepath):
            return safe_error('Photo not found', 404)

        os.remove(filepath)
        return jsonify({'success': True, 'message': 'Photo deleted'})

    except Exception as e:
        print(f"Error deleting photo: {e}")
        return safe_error('Failed to delete photo')


# --- Helper functions ---

def get_session_setting(session_id, setting_name):
    """Get a per-session setting from InfluxDB"""
    try:
        query = f'''
from(bucket: "{INFLUX_BUCKET}")
  |> range(start: -365d)
  |> filter(fn: (r) => r["_measurement"] == "session_probe_settings")
  |> filter(fn: (r) => r["session_id"] == "{session_id}")
  |> filter(fn: (r) => r["setting"] == "{setting_name}")
  |> filter(fn: (r) => r["_field"] == "value")
  |> last()
        '''

        tables = query_api.query(query, org=INFLUX_ORG)

        for table in tables:
            for record in table.records:
                return record.get_value() or ''

        return ''

    except Exception as e:
        print(f"Error getting session setting {setting_name}: {e}")
        return ''


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


def get_spices_list():
    """Helper function to get the saved list of spices from InfluxDB"""
    try:
        query = f'''
from(bucket: "{INFLUX_BUCKET}")
  |> range(start: -365d)
  |> filter(fn: (r) => r["_measurement"] == "spice_list")
  |> filter(fn: (r) => r["_field"] == "spices")
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
        print(f"Error getting spices list: {e}")
        return []


def get_hidden_setpoints_list(session_id):
    """Helper function to get hidden setpoint timestamps for a session"""
    try:
        query = f'''
from(bucket: "{INFLUX_BUCKET}")
  |> range(start: -365d)
  |> filter(fn: (r) => r["_measurement"] == "hidden_setpoints")
  |> filter(fn: (r) => r["session_id"] == "{session_id}")
  |> filter(fn: (r) => r["_field"] == "timestamps")
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
        print(f"Error getting hidden setpoints: {e}")
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
                'recipeUrl': '',
                'spices': '',
                'weight': '',
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
        if point.get('entityId') == 'smoke_session_recipe_url' and point.get('value'):
            session['recipeUrl'] = point['value']
        if point.get('entityId') == 'smoke_session_spices' and point.get('value'):
            session['spices'] = point['value']
        if point.get('entityId') == 'smoke_session_weight' and point.get('value'):
            session['weight'] = point['value']

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
            'recipeUrl': session['recipeUrl'] or '',
            'spices': session['spices'] or '',
            'weight': session['weight'] or '',
            'startTime': session['startTime'],
            'endTime': end_time,
            'hidden': is_hidden,
        })

    # Sort by start time (newest first)
    sessions.sort(key=lambda x: x['startTime'], reverse=True)

    return sessions


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=os.getenv('FLASK_ENV') == 'development')
