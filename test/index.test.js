
import { assert } from 'chai'
import { readFile } from 'fs/promises'

import { checkModule } from '../src/crapsChecker.js'


describe('CRAPS check', () => {

   before(() => {
   })

   it("find no error in samples/io.craps", async () => {
      const buffer = await readFile('./samples/io.craps')
      const text = buffer.toString()
      const { errorMsg } = checkModule(text)
      assert(!errorMsg)
   })

   it("find error in samples/io-err.craps", async () => {
      const buffer = await readFile('./samples/io-err.craps')
      const text = buffer.toString()
      const { errorMsg } = checkModule(text)
      assert(errorMsg.endsWith("symbol SW is undefined"))
   })

   after(() => {
   })
})

