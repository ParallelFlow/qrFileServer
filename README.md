# qrFileServer
Set up a simple web file manager using python flask to serve files and directories over your local network directly from your terminal. 

## Features
- Allows you to send and receive files.
- Contains basic file management features like moving, deleting, and creating files and directories, along with a basic text editor.
- Resumable uploads
- Download directories by zipping them on the fly

## Install
Clone the repo
```bash
git clone https://github.com/ParallelFlow/qrFileServer.git
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
Copy the example config. I highly recommend you to add some form of encryption.
```bash
cp qrFileServerConfig.py.example qrFileServerConfig.py
```
Optionally, to make the `start-qrFileServer.sh` bash script accessible anywhere you can link it to your `/usr/local/bin/`
```bash
sudo ln -s "$(realpath start-qrFileServer.sh)" /usr/local/bin/
```
## How to use

The bash script `start-qrFileServer.sh` is what you want to use to run this program.
```bash
./start-qrFileServer.sh
Usage: ./start-qrFileServer.sh path [--readonly] [path2 ... pathN]
```
Transfer as many directories and files as you like.
```bash
./start-qrFileServer.sh path/to/somewhere path/to/myfile.txt
```
Additionally add the --readonly option to only allow downloads.
```bash
./start-qrFileServer.sh path/to/somewhere path/to/myfile.txt --readonly
```

## How it works

Currently, this `start-qrFileServer.sh` bash script takes in file/directory path arguments and the optional '--readonly' argument. It stores the file/directory path arguments in a enviorment variable which is a base64 encoded string seperated by pipe character. It runs gunicorn with the config file `qrFileServerConfig.py` and the `app.py` which contains the flask webserver fetches the environment variable and the configurations from `qrFileServerConfig.py`.

By default, the example config will attempt to fetch a local ip address and gunicorn will try to bind to it on port 8000. By default, the webserver is not encrypted and needs to be manually configured.

In the default config, the authentication is done by checking 3 places
 - A token in the url query parameter
 - Cookies with the token parameter
 - HTTP Auth

The url query parameter is the easiest way to authenticate and it is meant to be randomly generated on each run.


## TODOS

- Clean up code, more consistant variable names. Maybe rewrite to use more classes and objects.
- Replace bash script for a more cross platform solution.
- Configure with command line arguments in addition to having a config file.


## Related
https://github.com/claudiodangelis/qrcp
