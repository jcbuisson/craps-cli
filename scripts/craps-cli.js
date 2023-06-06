#!/usr/bin/env node

import { program } from 'commander'
import { readFile } from 'fs/promises'

import { checkModule } from '../src/crapsChecker.js'
import { unsignedToBin32 } from '../src/binutils.js'


async function main() {
   program
      .name('craps-cli')
      .description('CLI to CRAPS operations')
      .version('1.0.0')

   program
   .command('check <source>')
   .description('Check a CRAPS program')
   .action(async (source) => {
      try {
         const buffer = await readFile(source)
         const text = buffer.toString()
         const { errorMsg, lines, symbols, memory } = checkModule(text)
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
   .action(async (source) => {
      try {
         const buffer = await readFile(source)
         const text = buffer.toString()
         const { errorMsg, lines, symbols, memory } = checkModule(text)
         if (errorMsg) {
            console.error(errorMsg)
         } else {
            // display memory contents
            for (const addr in memory) {
               const value = memory[addr].value
               console.log(unsignedToBin32(addr), value)
            }
         }
      } catch (err) {
         console.error(err)
      }
   })
      
   program
   .command('test <source> <testfile>')
   .description('Test a CRAPS program')
   .action(async (source, testfile) => {
      try {
         const buffer = await readFile(source)
         const text = buffer.toString()
         const { errorMsg, lines, symbols, memory } = checkModule(text)
         if (errorMsg) {
            console.error(errorMsg)
         } else {
            // run test file line by line
         }
      } catch (err) {
         console.error(err)
      }
   })
      
   program.parse()
}

main()
