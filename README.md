
# Installation

## Install node & npm
First check your version of nodejs:
```
node --version
```
If node is not installed of its version is < 14, you must upgrade it. On Debian-based linux:
```
curl -sL https://deb.nodesource.com/setup_18.x -o nodesource_setup.sh
sudo bash nodesource_setup.sh
sudo apt-get install -y nodejs
```

## Install craps cli
```
npm install craps-cli -g
```
On Unix, it installs a `craps` command in `/usr/local/bin/` (which links to a NodeJS script in `/usr/local/lib/node_modules/craps-cli`)


# Check a CRAPS program
```
craps check ./samples/add.craps
```
Prints out all errors


# Assemble a CRAPS program
```
craps assemble ./samples/add.craps
```
Prints out a memory dump


# Test a CRAPS program against a test file
```
craps test ./samples/add.craps ./sample-tests/add.tst
```
Run the test file line by line and stops at the first unverified 'check' statement.
