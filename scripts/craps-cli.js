#!/usr/bin/env node

import { program } from 'commander'
import inquirer from 'inquirer'
import { readFile } from 'fs/promises'

import { checkModule } from '../src/crapsChecker.js'


async function main() {
   try {
      program
         .option('-f, --file <filepath>', 'file path')

      program.parse()
      const options = program.opts()

      const answers = await inquirer.prompt([
         {
            type: 'input',
            name: 'file',
            message: 'Enter file path',
            when: !options.file,
         },
      ])
      const filepath = options.file || answers.file

      const buffer = await readFile(filepath)
      const text = buffer.toString()
      console.log('text', text)

      checkModule(text)


   } catch(err) {
      console.error(err.toString())
   } finally {
      process.exit(0)
   }
}

main()
