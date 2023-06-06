#!/usr/bin/env node

import { program } from 'commander'
import { readFile } from 'fs/promises'
import { promises as fs } from 'fs';

import { checkModule } from '../src/crapsChecker.js'


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
            console.log('No error found')
         }
      } catch (err) {
         console.error(err)
      }
   })
      
   program
   .command('test <source> <testfile')
   .description('Test a CRAPS program')
   .action((source, testfile) => {
      console.log('Running assemble command...', source, testfile)
      // Add your logic for the 'assemble' command here
   })
      
   program.parse()
}

main()
