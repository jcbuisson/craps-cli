
import { bin32ToUnsigned, bin32ToSigned, unsignedToBin32, bin16ToUnsigned, signedToBin32, sub32, add32, sll32, slr32, and32, or32, xor32 } from './binutils.js'


export async function runStop() {
   this.stop = !this.stop
   while (!this.stop) {
      this.step()
      this.stop = this.breakpoints.indexOf(this.currentAddress) !== -1
      await sleep(10)
   }
}

export function step () {
   try {
      this.cycleCount += 1
      if (this.itFlipFlop === 1) {
         // interrupt
         // clear IT bit
         this.itFlipFlop = 0
         // push %pc
         let sp32 = sub32(this.getRegisterValue(29), '00000000000000000000000000000001').result
         this.setRegisterValue(29, sp32)
         let sp = bin32ToUnsigned(sp32)
         this.setMemoryContent(sp, this.getRegisterValue(30))
         // push NZVC
         sp32 = sub32(this.getRegisterValue(29), '00000000000000000000000000000001').result
         this.setRegisterValue(29, sp32)
         sp = bin32ToUnsigned(sp32)
         this.setMemoryContent(sp, '0000000000000000000000000000' + (this.flagArray[0] ? '1' : '0') + (this.flagArray[1] ? '1' : '0') + (this.flagArray[2] ? '1' : '0') + (this.flagArray[3] ? '1' : '0'))
         // goto 1
         this.setRegisterValue(30, '00000000000000000000000000000001')
         this.currentAddress = 1
      } else {
         // no interrupt - execute next instruction
         let currentLine = this.memoryDict[this.currentAddress]
         //console.log('currentLine', currentLine)
         // set %r31 = instruction code
         this.setRegisterValue(31, this.memoryDict[this.currentAddress].value)
         if (currentLine.instruction) {
            // execute instruction
            if (currentLine.instruction.type === 'instructionBcc') {
               if (this.evalCondition(currentLine.instruction)) {
                  this.setCurrentAddress(this.currentAddress + currentLine.instruction.disp)
               } else {
                  this.setCurrentAddress(this.currentAddress + 1)
               }
            } else if (currentLine.instruction.type === 'instructionArithLog1a') {
               let rs1Value = this.getRegisterValue(currentLine.instruction.rs1)
               let rs2Value = this.getRegisterValue(currentLine.instruction.rs2)
               let result = this.compute(currentLine.instruction.codeop, rs1Value, rs2Value)
               this.setRegisterValue(currentLine.instruction.rd, result)
               this.setCurrentAddress(this.currentAddress + 1)
            } else if (currentLine.instruction.type === 'instructionArithLog1b') {
               let rs1Value = this.getRegisterValue(currentLine.instruction.rs1)
               let simm13Value = signedToBin32(currentLine.instruction.simm13)
               let result = this.compute(currentLine.instruction.codeop, rs1Value, simm13Value)
               this.setRegisterValue(currentLine.instruction.rd, result)
               this.setCurrentAddress(this.currentAddress + 1)
            } else if (currentLine.instruction.type === 'instructionLoad1a') {
               let address32 = add32(this.getRegisterValue(currentLine.instruction.rs1), this.getRegisterValue(currentLine.instruction.rs2))
               let address = bin32ToUnsigned(address32.result)
               let content = this.getMemoryContent(address)
               this.setRegisterValue(currentLine.instruction.rd, content)
               this.setCurrentAddress(this.currentAddress + 1)
            } else if (currentLine.instruction.type === 'instructionLoad1b') {
               let simm13 = currentLine.instruction.plusMinus === '+' ? currentLine.instruction.simm13 : -currentLine.instruction.simm13
               let simm13_32 = signedToBin32(simm13)
               let address32 = add32(this.getRegisterValue(currentLine.instruction.rs1), simm13_32)
               let address = bin32ToUnsigned(address32.result)
               let content = this.getMemoryContent(address)
               this.setRegisterValue(currentLine.instruction.rd, content)
               this.setCurrentAddress(this.currentAddress + 1)
            } else if (currentLine.instruction.type === 'instructionStore1a') {
               let address32 = add32(this.getRegisterValue(currentLine.instruction.rs1), this.getRegisterValue(currentLine.instruction.rs2))
               let address = bin32ToUnsigned(address32.result)
               let content = this.getRegisterValue(currentLine.instruction.rd)
               this.setMemoryContent(address, content)
               this.setCurrentAddress(this.currentAddress + 1)
            } else if (currentLine.instruction.type === 'instructionStore1b') {
               let simm13 = currentLine.instruction.plusMinus === '+' ? currentLine.instruction.simm13 : -currentLine.instruction.simm13
               let simm13_32 = signedToBin32(simm13)
               let address32 = add32(this.getRegisterValue(currentLine.instruction.rs1), simm13_32)
               let address = bin32ToUnsigned(address32.result)
               let content = this.getRegisterValue(currentLine.instruction.rd)
               this.setMemoryContent(address, content)
               this.setCurrentAddress(this.currentAddress + 1)
            } else if (currentLine.instruction.type === 'instructionSethi') {
               let imm24Value = _.padStart(parseInt(currentLine.instruction.imm24, 10).toString(2), 24, '0')
               this.setRegisterValue(currentLine.instruction.rd, imm24Value + '00000000')
               this.setCurrentAddress(this.currentAddress + 1)
            } else if (currentLine.instruction.type === 'instructionReti') {
               // pop NZVC
               let sp32 = this.getRegisterValue(29)
               let sp = bin32ToUnsigned(sp32)
               let data = this.getMemoryContent(sp)
               for (let i = 0; i < 4; i++) {
                  this.flagArray[i] = (data[28 + i] === '1')
               }
               sp32 = add32(sp32, '00000000000000000000000000000001').result
               this.setRegisterValue(29, sp32)
               // pop %pc
               sp32 = this.getRegisterValue(29)
               sp = bin32ToUnsigned(sp32)
               let pcBin32 = this.getMemoryContent(sp)
               this.setRegisterValue(30, pcBin32)
               sp32 = add32(sp32, '00000000000000000000000000000001').result
               this.setRegisterValue(29, sp32)
               this.setCurrentAddress(bin32ToUnsigned(pcBin32))
            }
         } else if (currentLine.synthetic) {
            if (currentLine.synthetic.type === 'clr') {
               this.setRegisterValue(currentLine.synthetic.rd, '00000000000000000000000000000000')
               this.setCurrentAddress(this.currentAddress + 1)
            } else if (currentLine.synthetic.type === 'mov') {
               this.setRegisterValue(currentLine.synthetic.rd, this.getRegisterValue(currentLine.synthetic.rs))
               this.setCurrentAddress(this.currentAddress + 1)
            } else if (currentLine.synthetic.type === 'inc') {
               let rdContent = this.getRegisterValue(currentLine.synthetic.rd)
               let rdValue = bin32ToSigned(rdContent)
               this.setRegisterValue(currentLine.synthetic.rd, signedToBin32(rdValue + 1))
               this.setCurrentAddress(this.currentAddress + 1)
            } else if (currentLine.synthetic.type === 'inccc') {
               let rdContent = this.getRegisterValue(currentLine.synthetic.rd)
               let rdValue = bin32ToSigned(rdContent)
               this.setRegisterValue(currentLine.synthetic.rd, signedToBin32(rdValue + 1))
               this.setFlag(0, rdValue + 1 < 0)
               this.setFlag(1, rdValue + 1 === 0)
               this.setFlag(2, rdValue === 2147483647)
               this.setFlag(3, rdValue === 4294967295)
               this.setCurrentAddress(this.currentAddress + 1)
            } else if (currentLine.synthetic.type === 'dec') {
               let rdContent = this.getRegisterValue(currentLine.synthetic.rd)
               let rdValue = bin32ToSigned(rdContent)
               this.setRegisterValue(currentLine.synthetic.rd, signedToBin32(rdValue - 1))
               this.setCurrentAddress(this.currentAddress + 1)
            } else if (currentLine.synthetic.type === 'deccc') {
               let rdContent = this.getRegisterValue(currentLine.synthetic.rd)
               let rdValue = bin32ToSigned(rdContent)
               this.setRegisterValue(currentLine.synthetic.rd, signedToBin32(rdValue - 1))
               this.setFlag(0, rdValue - 1 < 0)
               this.setFlag(1, rdValue - 1 === 0)
               this.setFlag(2, rdValue === -2147483648)
               this.setFlag(3, rdValue === -4294967296)
               this.setCurrentAddress(this.currentAddress + 1)
            } else if (currentLine.synthetic.type === 'setq') {
               let simm13Value = signedToBin32(currentLine.synthetic.simm13)
               this.setRegisterValue(currentLine.synthetic.rd, simm13Value)
               this.setCurrentAddress(this.currentAddress + 1)
            } else if (currentLine.synthetic.type === 'set') {
               let simm32Value = signedToBin32(currentLine.synthetic.simm32)
               this.setRegisterValue(currentLine.synthetic.rd, simm32Value)
               this.setCurrentAddress(this.currentAddress + 2)
            } else if (currentLine.synthetic.type === 'cmp') {
               let rsValueSigned = bin32ToSigned(this.getRegisterValue(currentLine.synthetic.rs))
               let rsValueUnsigned = bin32ToUnsigned(this.getRegisterValue(currentLine.synthetic.rs))
               if (currentLine.synthetic.rd !== undefined) {
                  let rdValueSigned = bin32ToSigned(this.getRegisterValue(currentLine.synthetic.rd))
                  let rdValueUnsigned = bin32ToUnsigned(this.getRegisterValue(currentLine.synthetic.rd))
                  //console.log('rdValueSigned', rdValueSigned, 'rsValueSigned', rsValueSigned)
                  let diffSigned = rsValueSigned - rdValueSigned
                  this.setFlag(0, diffSigned < 0) // N
                  this.setFlag(1, diffSigned === 0) // Z
                  this.setFlag(2, rsValueSigned < 0 && rdValueSigned >= 0 && diffSigned >= 0 || rsValueSigned >= 0 && rdValueSigned < 0 && diffSigned < 0) // V
                  this.setFlag(3, rsValueUnsigned < rdValueUnsigned) // C
               } else {
                  let diffSigned = rsValueSigned - currentLine.synthetic.simm13
                  this.setFlag(0, diffSigned < 0) // N
                  this.setFlag(1, diffSigned === 0) // Z
                  this.setFlag(2, rsValueSigned < 0 && currentLine.synthetic.simm13 >= 0 && diffSigned >= 0 || rsValueSigned >= 0 && currentLine.synthetic.simm13 < 0 && diffSigned < 0) // V
                  this.setFlag(3, diffSigned < 0) // C ????
               }
               this.setCurrentAddress(this.currentAddress + 1)
            } else if (currentLine.synthetic.type === 'tst') {
               let rsValueSigned = bin32ToSigned(this.getRegisterValue(currentLine.synthetic.rs))
               let rsValueUnsigned = bin32ToUnsigned(this.getRegisterValue(currentLine.synthetic.rs))
               this.setFlag(0, rsValueSigned < 0) // N
               this.setFlag(1, rsValueSigned === 0) // Z
               this.setFlag(2, false) // V
               this.setFlag(3, false) // C
               this.setCurrentAddress(this.currentAddress + 1)
            } else if (currentLine.synthetic.type === 'negcc') {
               let rdValueSigned = bin32ToSigned(this.getRegisterValue(currentLine.synthetic.rd))
               this.setRegisterValue(currentLine.synthetic.rd, signedToBin32(-rdValueSigned))
               this.setFlag(0, -rdValueSigned < 0) // N
               this.setFlag(1, rdValueSigned === 0) // Z
               this.setFlag(2, false) // V
               this.setFlag(3, false) // C
               this.setCurrentAddress(this.currentAddress + 1)
            } else if (currentLine.synthetic.type === 'nop') {
               this.setCurrentAddress(this.currentAddress + 1)
            } else if (currentLine.synthetic.type === 'call') {
               this.setRegisterValue(28, this.getRegisterValue(30))
               this.setCurrentAddress(this.currentAddress + currentLine.synthetic.disp + 1)
            } else if (currentLine.synthetic.type === 'ret') {
               let r28 = bin32ToUnsigned(this.getRegisterValue(28))
               let returnAddress = r28 + 2
               this.setRegisterValue(30, unsignedToBin32(returnAddress))
               this.setCurrentAddress(returnAddress)
            } else if (currentLine.synthetic.type === 'push') {
               let sp32 = sub32(this.getRegisterValue(29), '00000000000000000000000000000001').result
               this.setRegisterValue(29, sp32)
               let sp = bin32ToUnsigned(sp32)
               this.setMemoryContent(sp, this.getRegisterValue(currentLine.synthetic.rs))
               this.setCurrentAddress(this.currentAddress + 2)
            } else if (currentLine.synthetic.type === 'pop') {
               let sp32 = this.getRegisterValue(29)
               let sp = bin32ToUnsigned(sp32)
               this.setRegisterValue(currentLine.synthetic.rd, this.getMemoryContent(sp))
               sp32 = add32(sp32, '00000000000000000000000000000001').result
               this.setRegisterValue(29, sp32)
               this.setCurrentAddress(this.currentAddress + 2)
            }
         }
      }
   } catch(error) {
      this.errorMsg = error.message
      this.stop = true
   }
}

function setCurrentAddress(address) {
   this.setRegisterValue(30, unsignedToBin32(address))
   let content = this.memoryDict[address]
   if (!content) {
      let message = `*** execution at uninitialized memory location 0x${address.toString(16)}`
      throw new Error(message)
   }
   this.currentAddress = address
}

function getRegisterValue(regno) {
   if (regno === 0) {
      return '00000000000000000000000000000000'
   } else {
      return this.registerValues[regno]
   }
}

function setRegisterValue(regno, bin32Value) {
   if (regno > 0) {
      Vue.set(this.registerValues, regno, bin32Value)
   }
}

function getMemoryContent(address) {
   if (address < 0x10000000) {
      let memoryEntry = this.memoryDict[address]
      if (!memoryEntry) {
         let message = `*** read-access to uninitialized memory location 0x${address.toString(16)}`
         throw new Error(message)
      }
      //console.log('getMemoryContent', address, memoryEntry.value)
      return memoryEntry.value
   } else if (address === 0x90000000) {
      let result = ''
      for (let i = 31; i >= 0; i--) {
         if (i > 16) {
            result += '0'
         } else {
            result += (this.switches[i] ? '1' : '0')
         }
      }
      return result
   } else {
      let message = `*** read-access to unmapped memory location 0x${address.toString(16)}`
      throw new Error(message)
   }
}

function setMemoryContent(address, content) {
   //console.log('setMemoryContent', address, content)
   if (address < 0x10000000) {
      let memoryEntry = { text: '', label: '', value: content }
      this.memoryDict[address] = memoryEntry
      // force update of memory text
      this.versionNo += 1
   } else if (address === 0xB0000000) {
      for (let i = 0; i < 16; i++) {
         let bit = content.charAt(31-i)
         Vue.set(this.leds, i, bit==='1')
      }
   } else {
      let message = `*** write-access to unmapped memory location 0x${address.toString(16)}`
      throw new Error(message)
   }
}

function swClick(bitno) {
   Vue.set(this.switches, bitno, !this.switches[bitno])
}

// 0123: NZVC
function getFlag(flagIndex) {
   return this.flagArray.indexOf(flagIndex) !== -1
}

function setFlag(flag, value) {
   if (value) {
      if (this.flagArray.indexOf(flag) === -1) {
         this.flagArray.push(flag)
      }
   } else {
      let index = this.flagArray.indexOf(flag)
      if (index !== -1) {
         this.flagArray.splice(index, 1)
      }
   }
}

function evalCondition(instruction) {
   if (instruction.cond === 'a') {
      return true
   } else if (instruction.cond === 'z' || instruction.cond === 'e' || instruction.cond === 'eq') {
      let Z = this.getFlag(1)
      return Z
   } else if (instruction.cond === 'nz' || instruction.cond === 'ne') {
      let Z = this.getFlag(1)
      return !Z
   } else if (instruction.cond === 'neg' || instruction.cond === 'n') {
      let N = this.getFlag(0)
      return N
   } else if (instruction.cond === 'pos' || instruction.cond === 'nn') {
      let N = this.getFlag(0)
      return !N
   } else if (instruction.cond === 'cs' || instruction.cond === 'lu') {
      let C = this.getFlag(3)
      return C
   } else if (instruction.cond === 'cc' || instruction.cond === 'geu') {
      let C = this.getFlag(3)
      return !C
   } else if (instruction.cond === 'g' || instruction.cond === 'gt') {
      let N = this.getFlag(0)
      let Z = this.getFlag(1)
      let V = this.getFlag(2)
      return !(Z || (N !== V))
   } else if (instruction.cond === 'ge') {
      let N = this.getFlag(0)
      let V = this.getFlag(2)
      return N === V
   } else if (instruction.cond === 'l' || instruction.cond === 'lt') {
      let N = this.getFlag(0)
      let V = this.getFlag(2)
      return N !== V
   } else if (instruction.cond === 'le') {
      let N = this.getFlag(0)
      let Z = this.getFlag(1)
      let V = this.getFlag(2)
      return (Z || (N !== V))
   } else if (instruction.cond === 'gu') {
      let Z = this.getFlag(1)
      let C = this.getFlag(3)
      return !(Z || C)
   } else if (instruction.cond === 'leu') {
      let Z = this.getFlag(1)
      let C = this.getFlag(3)
      return (Z || C)
   }
}

function compute(codeop, arg1, arg2) {
   //console.log('compute codeop', codeop, 'arg1', arg1, 'arg2', arg2)
   let result
   if (codeop.startsWith('add') || codeop.startsWith('sub')) {
      let { result: res, V: V, C: C } = codeop.startsWith('add') ? add32(arg1, arg2) : sub32(arg1, arg2)
      //console.log('res', res, 'V', V, 'C', C)
      result = res
      if (codeop.endsWith('cc')) {
         // set flags
         this.setFlag(0, result.charAt(0) === '1') // N
         this.setFlag(1, result.indexOf('1') === -1) // Z
         this.setFlag(2, V) // V
         this.setFlag(3, C) // C
      }
   } else if (codeop === 'umulcc') {
      let varg1 = bin16ToUnsigned(arg1.substring(16))
      let varg2 = bin16ToUnsigned(arg2.substring(16))
      result = unsignedToBin32(varg1 * varg2)
      // set N,Z
      this.setFlag(0, result.charAt(0) === '1') // N
      this.setFlag(1, result.indexOf('1') === -1) // Z
   } else if (codeop.startsWith('and') || codeop.startsWith('or') || codeop.startsWith('xor')) {
      if (codeop.startsWith('and')) {
         result = and32(arg1, arg2)
      } else if (codeop.startsWith('or')) {
         result = or32(arg1, arg2)
      } else if (codeop.startsWith('xor')) {
         result = xor32(arg1, arg2)
      }
      if (codeop.endsWith('cc')) {
         // set N,Z
         this.setFlag(0, result.charAt(0) === '1') // N
         this.setFlag(1, result.indexOf('1') === -1) // Z
      }
   } else if (codeop === 'slr') {
      result = slr32(arg1, arg2)
   } else if (codeop === 'sll') {
      result = sll32(arg1, arg2)
   }
   return result
}

function sendIT() {
   console.log('IT!')
   this.itFlipFlop = 1
}
