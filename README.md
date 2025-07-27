# qrFileServer
Easily create a webserver with flask to serve files and directories over http to transfer files by a scanning a qrcode directly from the terminal.

## Features
- Allows you to send and receive files.
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
Transfer as many directories and files as you like like this
```bash
./start-qrFileServer.sh path/to/somewhere path/to/myfile.txt
```
Additionally add the --readonly option to deny uploads.
```bash
./start-qrFileServer.sh path/to/somewhere path/to/myfile.txt --readonly
```

## Related
https://github.com/claudiodangelis/qrcp
