
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

```
gcd.craps
// compute greater common denominator
         set    78, %r1 // valeur de x
         set    143, %r2 // valeur de y
         
pgcd:    cmp    %r2, %r1 // while x <> y
         bne    skip // x=y?
         // x = y: return x
         ba     stop
skip:    bneg   sup // x>y?
         // x < y
         subcc  %r2, %r1, %r2 // y <- y - x
         ba     pgcd
sup:     // x > y
         subcc  %r1, %r2, %r1 // x <- x - y
         ba     pgcd
stop:    ba     stop
```

```
gcd.test
clock            40
check-register   1      13
```

## Test commands

- `clock`: run simulation for one step. A synthetic instruction simulation counts for one step.
- `clock {count}`: run simulation for `count` steps.
- `interrupt`: triggers an interrupt
- `switch {index} {value}`: set switch `index` to `value`
- `check-memory {address} {value}`: check that memory location `address` contains `value`.
- `check-register {regno} {value}`: check that register of index `regno` contains `value`.
