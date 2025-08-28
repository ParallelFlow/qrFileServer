# qrFileServer
Set up a simple web file manager using python flask to serve files and directories over your local network directly from your terminal. 

## Features
- Allows you to send and receive files.
- Contains basic file management features like moving, deleting, and creating files and directories, along with a basic text editor.
- Resumable uploads
- Download directories by zipping them on the fly

# Demo


## Install
Clone the repo and cd into it.
```bash
git clone https://github.com/ParallelFlow/qrFileServer.git
cd qrFileServer
```
Create and source virtual environment
```bash
python -m venv ./venv
source venv/bin/activate
```
Install dependencies
```bash
pip install -r requirements.txt
```
Copy the example config. I highly recommend you to add your own tls certs or use some form of encryption in the gunicornConfig.
```bash
cp qrFileServerConfig.py.example qrFileServerConfig.py
cp gunicornConfig.py.example gunicornConfig.py
```
Optionally, to make the `start-qrFileServer.py` python script accessible anywhere you can link it to your `/usr/local/bin/`.
```bash
sudo ln -s "$(realpath start-qrFileServer.py)" /usr/local/bin/
```
## How to use
The python script `start-qrFileServer.py` is what you want to use to run this program.
```bash
./start-qrFileServer.py
usage: start-qrFileServer.py [-h] [--readonly] [--token TOKEN] [--gunicorn-args GUNICORN_ARGS]
                             paths [paths ...]

Launch a http server to send and receive files and directories.

positional arguments:
  paths                 One or more file or directory path to serve.

options:
  -h, --help            show this help message and exit
  --readonly, -r        Set read-only mode to disallow modifications.
  --token TOKEN, -t TOKEN
                        Enter custom token/password for authentication
  --gunicorn-args GUNICORN_ARGS, -g GUNICORN_ARGS
                        Enter custom gunicorn arguments
```
Transfer as many directories and files as you like.
```bash
./start-qrFileServer.py path/to/somewhere path/to/myfile.txt
```
Add the `--readonly` argument to only allow downloads.
```bash
./start-qrFileServer.py path/to/somewhere path/to/myfile.txt --readonly
```
Use the `--token` argument to set a custom password. (Edit the `qrFileServerConfig.py` to set it permanently.)
```bash
./start-qrFileServer.py path/to/somewhere path/to/myfile.txt --token mysecretpassword
```
Use the `--gunicorn-args` to set [custom gunicorn arguments](https://docs.gunicorn.org/en/stable/run.html). (Edit the `gunicornConfig.py` to set it permanently.)
```bash
./start-qrFileServer.py path/to/somewhere path/to/myfile.txt --gunicorn-args "--bind laptop.local:8080"
```

## How it works
With the default config, running `start-qrFileServer.py` will run gunicorn to start the webserver which binds to all network addresses on port 8000.

A qrcode will appear in this format: `http://{ip}:{port}/?token={token}`

A randomly generated 16 alphanumeric token in the url query parameter is used to authenticate this webserver on startup. Additionally this program uses http auth to authenticate. The default user and password is token:<generated token>.

## TODOS

- Simplify js functions, use consistent file names.
- Make directory in the client be update in place instead of deleting and replacing.
- Make a more cross platform solution for windows.
- Improve website looks and styles.
- Reduce overhead in file upload.
- Make traversing directories in client side be on demand.

## Related
https://github.com/claudiodangelis/qrcp
