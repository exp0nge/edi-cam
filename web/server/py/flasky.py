import subprocess
from flask import Flask, render_template
from flask_socketio import SocketIO, send

app = Flask(__name__, static_url_path='/static')
socketio = SocketIO(app)

ffmpeg_status = subprocess.call('../../../bin/do_ffmpeg.sh')
print("do_ffmpeg returned: %i", ffmpeg_status)


@app.route('/')
def index():
    return render_template('index.html')


@socketio.on('data')
def streamer(data):
    send(data, broadcast=True)


if __name__ == '__main__':
    socketio.run(app)
