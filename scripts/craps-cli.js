#!/usr/bin/env node

import { program } from 'commander'
import { readFile } from 'fs/promises'
import { bin32ToUnsigned, unsignedToBin32, unsignedToHex8, bin32ToSigned } from '../src/binutils.js'

import { checkModule } from '../src/crapsChecker.js'
import { step } from '../src/crapsSimulator.js'
import { peg$parse as parseTest } from '../src/test_parser.js'
// import packageData from '../package.json' assert {type: 'json'}

main()

async function main() {
   program
      .name('craps')
      .description('CLI for CRAPS operations')
      // .version(packageData.version)
      .version('1.0.5')

   program
   .command('check <source>')
   .description('Check a CRAPS program and display errors')
   .action(async (source) => {
      try {
         const buffer = await readFile(source)
         const text = buffer.toString()
         const { errorMsg } = checkModule(text)
         if (errorMsg) {
            console.error(errorMsg)
         } else {
            console.log('No error found')
         }
      } catch (err) {
         console.error(err)
      }
   })
      
   program
   .command('assemble <source>')
   .description('Assemble a CRAPS program and dump the resulting memory content')
   .action(async (source) => {
      try {
         const buffer = await readFile(source)
         const text = buffer.toString()
         const { errorMsg, memory } = checkModule(text)
         if (errorMsg) {
            console.error(errorMsg)
         } else {
            // display memory contents
            dumpMemory(memory)
         }
      } catch (err) {
         console.error(err)
      }
   })
      
   program
   .command('test <source> <testfile>')
   .description('Test a CRAPS program against a test file')
   .option('-v, --verbose', "display executed instructions")
   .action(async (source, testfile, { verbose }) => {
      try {
         // parse craps program
         const buffer = await readFile(source)
         const text = buffer.toString()
         const { errorMsg, memory } = checkModule(text)
         if (errorMsg) throw new Error(errorMsg)
         // initial simulation state
         let state = {
            currentAddress: 0,
            memoryDict: memory,
            registerDict: Array.from({ length: 32 }).fill('00000000000000000000000000000000'),
            flagArray: [false, false, false, false], // NZVC
            switchArray: Array.from({ length: 32 }).fill(0),
            ledArray: Array.from({ length: 32 }).fill(0),
            it: false,
         }
         // parse test file
         const buffer2 = await readFile(testfile)
         const text2 = buffer2.toString()
         let commandList
         try {
            commandList = parseTest(text2)
         } catch(err) {
            let location = ''
            if (err.location) {
               location = `:${err.location.start.line} `
            }
            const cause = 1
            throw new Error(`${testfile}${location}(errno: ${cause}) ${err.message}`, { cause })
         }
         // execute commands one by one
         for (const command of commandList) {
            if (verbose) console.log(`>> ${testfile}:${command.lineno} ${command.match}`)
            if (command.type === 'clock') {
               try {
                  for (let i = 0; i < command.count; i++) {
                     // simulate one clock cycle and update state
                     state = step(state, verbose)
                  }
               } catch(err) {
                   if (err.message !== "halt") { // PQ 24/10/23
                       console.error(err.stack)
                       throw new Error(`${testfile}:${command.lineno} (errno: ${err.cause}) ${err.message}`, { cause: err.cause })
                   }
               }
            } else if (command.type === 'interrupt') {
               // add it to state
               state.it = true
            } else if (command.type === 'switch') {
               // modify switch value in state
               state.switchArray[command.swIndex] = command.swValue

            } else if (command.type === 'check-memory') {
               const stateValue = bin32ToSigned(state.memoryDict[command.memIndex].value)
               if (stateValue !== command.memValue) {
                  const cause = 2
                  throw new Error(`${testfile}:${command.lineno}(errno: ${cause}) memory check failed at location 0x${unsignedToHex8(command.memIndex)}; got ${stateValue}; expected ${command.memValue}`, { cause })
               }
            } else if (command.type === 'check-register') {
               const stateValue = bin32ToSigned(state.registerDict[command.regIndex])
               if (stateValue !== command.regValue) {
                  if (verbose) dumpRegisters(state.registerDict)
                  const cause = 3
                  throw new Error(`${testfile}:${command.lineno}(errno: ${cause}) register %r${command.regIndex} check failed; got ${stateValue}; expected ${command.regValue}`, { cause })
               }
            }
         }
         console.log("tests passed successfully")
         if (verbose) dumpRegisters(state.registerDict)
      } catch (err) {
         console.error(err.stack)
         console.error(err.message)
         process.exit(err.cause || -100)
      }
   })

   // ajout PQ 24/10/24
   program
   .command('run <source>')
   .description('Execute a CRAPS program until it halts')
   .option('-v, --verbose', "display executed instructions")
   .option('-s, --stack', "print stack when it halts")
   .option('-d, --dune', "for dune runtest (no filename, output on stdout)")
   .action(async (source, { verbose, stack, dune }) => {
      try {
         // parse craps program
         const buffer = await readFile(source)
         const text = buffer.toString()
         const { errorMsg, memory } = checkModule(text)
         if (errorMsg) throw new Error(errorMsg)
         // initial simulation state
         let state = {
            currentAddress: 0,
            memoryDict: memory,
            registerDict: Array.from({ length: 32 }).fill('00000000000000000000000000000000'),
            flagArray: [false, false, false, false], // NZVC
            switchArray: Array.from({ length: 32 }).fill(0),
            ledArray: Array.from({ length: 32 }).fill(0),
            it: false,
         }
          try {
             while (true) {
                 // simulate one clock cycle and update state
                 state = step(state, verbose)
             }
         } catch(err) {
             if (err.message !== "halt") {
                 if (! dune) {
                     console.error(err.stack)
                     throw new Error(`${source}: (errno: ${err.cause}) ${err.message}`, { cause: err.cause })
                 } else {
                     throw new Error(`${err.message}`, { cause: err.cause })
                 }
             } else {
                 process.stdout.write("\n")
             }
         }
         if (stack) dumpStack(state.registerDict, state.memoryDict)          
      } catch (err) {
         if (! dune) console.error(err.message)
         else console.log(err.message)
         process.exit(err.cause || -100)
      }
   })
    
   program.parse()
}

function dumpMemory(memory) {
   for (const addr in memory) {
      const value = memory[addr].value
      console.log(unsignedToBin32(addr), value)
   }
}

function dumpRegisters(registers) {
   for (const regno in registers) {
      const value = registers[regno]
      console.log(`%r${regno}`.padStart(4), value)
   }
}

// PQ 25/10/23
function dumpStack(registers, memory) {
    const sp = bin32ToUnsigned(registers[29])
    const fp = bin32ToUnsigned(registers[27])
    console.log('%%sp = ', sp)
    console.log('%%fp = ', fp)
    for (let i = 20; i > -20; i--) {
        const value = memory[sp + i]?.value
        if (value) console.log(""+(sp+i), " : ", bin32ToUnsigned(value))
    }
}
