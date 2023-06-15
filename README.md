
# Installation

## Install node & npm
First check your version of nodejs:
```
node --version
```
If node is not installed or its version is < 14, you must install/upgrade it. On Debian-based linux:
```
curl -sL https://deb.nodesource.com/setup_18.x -o nodesource_setup.sh
sudo bash nodesource_setup.sh
sudo apt-get install -y nodejs
```

## Install CRAPS CLI
```
npm install craps-cli -g
```
On Unix, it installs a `craps` command in `/usr/local/bin/` (which links to NodeJS script `/usr/local/lib/node_modules/craps-cli`)


# Check a CRAPS program
```
craps check ./samples/pgcd.craps
```
Prints out all errors


# Assemble a CRAPS program
```
craps assemble ./samples/pgcd.craps
```
Prints out a memory dump


# Test a CRAPS program against a test file
```
craps test ./samples/pgcd.craps ./samples/pgcd.test
```
Run the test file line by line and stops at the first unverified 'check' statement or memory access error.
Return a unix status code:

```
0: passed all tests
1: syntax or semantic error in test file
2: memory check failed
3: register check failed
4 : memory read at uninitialized address
5 : memory write at unmapped memory address
6 : program counter at uninitialized memory address
7 : memory read at unmapped memory address
100: unknown error
```
