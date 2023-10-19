
import { bin32ToUnsigned, bin32ToSigned, unsignedToBin32, bin16ToUnsigned, signedToBin32, sub32, add32, sll32, slr32, and32, or32, xor32 } from './binutils.js'

import lodashPkg from 'lodash'
const { padStart } = lodashPkg



export function step({ currentAddress, memoryDict, registerDict, flagArray, switchArray, ledArray, it}, verbose) {
   if (it) {
      // interrupt
      // push %pc
      const sp32 = sub32(getRegisterValue(29), '00000000000000000000000000000001').result
      setRegisterValue(29, sp32)
      const sp = bin32ToUnsigned(sp32)
      setMemoryContent(sp, getRegisterValue(30))
      // push NZVC
      sp32 = sub32(getRegisterValue(29), '00000000000000000000000000000001').result
      setRegisterValue(29, sp32)
      sp = bin32ToUnsigned(sp32)
      setMemoryContent(sp, '0000000000000000000000000000' + (flagArray[0] ? '1' : '0') + (flagArray[1] ? '1' : '0') + (flagArray[2] ? '1' : '0') + (flagArray[3] ? '1' : '0'))
      // goto 1
      setRegisterValue(30, '00000000000000000000000000000001')
      currentAddress = 1
      return({
         currentAddress, memoryDict, registerDict, flagArray, switchArray, ledArray,
         it: false,
      })
   } else {
      // no interrupt - execute next instruction
      const currentLine = memoryDict[currentAddress]
      if (verbose) console.log(currentLine.instruction ? currentLine.instruction?.text : currentLine?.synthetic?.text)
      // set %r31 = instruction code
      setRegisterValue(31, memoryDict[currentAddress].value)
      if (currentLine.instruction) {
         // execute instruction
         if (currentLine.instruction.type === 'instructionBcc') {
            if (evalCondition(currentLine.instruction)) {
               setCurrentAddress(currentAddress + currentLine.instruction.disp)
            } else {
               setCurrentAddress(currentAddress + 1)
            }
         } else if (currentLine.instruction.type === 'instructionArithLog1a') {
            const rs1Value = getRegisterValue(currentLine.instruction.rs1)
            const rs2Value = getRegisterValue(currentLine.instruction.rs2)
            const result = compute(currentLine.instruction.codeop, rs1Value, rs2Value)
            setRegisterValue(currentLine.instruction.rd, result)
            setCurrentAddress(currentAddress + 1)
         } else if (currentLine.instruction.type === 'instructionArithLog1b') {
            const rs1Value = getRegisterValue(currentLine.instruction.rs1)
            const simm13Value = signedToBin32(currentLine.instruction.simm13)
            const result = compute(currentLine.instruction.codeop, rs1Value, simm13Value)
            setRegisterValue(currentLine.instruction.rd, result)
            setCurrentAddress(currentAddress + 1)
         } else if (currentLine.instruction.type === 'instructionLoad1a') {
            const address32 = add32(getRegisterValue(currentLine.instruction.rs1), getRegisterValue(currentLine.instruction.rs2))
            const address = bin32ToUnsigned(address32.result)
            const content = getMemoryContent(address)
            setRegisterValue(currentLine.instruction.rd, content)
            setCurrentAddress(currentAddress + 1)
         } else if (currentLine.instruction.type === 'instructionLoad1b') {
            const simm13 = currentLine.instruction.plusMinus === '+' ? currentLine.instruction.simm13 : -currentLine.instruction.simm13
            const simm13_32 = signedToBin32(simm13)
            const address32 = add32(getRegisterValue(currentLine.instruction.rs1), simm13_32)
            const address = bin32ToUnsigned(address32.result)
            const content = getMemoryContent(address)
            setRegisterValue(currentLine.instruction.rd, content)
            setCurrentAddress(currentAddress + 1)
         } else if (currentLine.instruction.type === 'instructionStore1a') {
            const address32 = add32(getRegisterValue(currentLine.instruction.rs1), getRegisterValue(currentLine.instruction.rs2))
            const address = bin32ToUnsigned(address32.result)
            const content = getRegisterValue(currentLine.instruction.rd)
            setMemoryContent(address, content)
            setCurrentAddress(currentAddress + 1)
         } else if (currentLine.instruction.type === 'instructionStore1b') {
            const simm13 = currentLine.instruction.plusMinus === '+' ? currentLine.instruction.simm13 : -currentLine.instruction.simm13
            const simm13_32 = signedToBin32(simm13)
            const address32 = add32(getRegisterValue(currentLine.instruction.rs1), simm13_32)
            const address = bin32ToUnsigned(address32.result)
            const content = getRegisterValue(currentLine.instruction.rd)
            setMemoryContent(address, content)
            setCurrentAddress(currentAddress + 1)
         } else if (currentLine.instruction.type === 'instructionSethi') {
            const imm24Value = padStart(parseInt(currentLine.instruction.imm24, 10).toString(2), 24, '0')
            setRegisterValue(currentLine.instruction.rd, imm24Value + '00000000')
            setCurrentAddress(currentAddress + 1)
         } else if (currentLine.instruction.type === 'instructionReti') {
            // pop NZVC
            const sp32 = getRegisterValue(29)
            const sp = bin32ToUnsigned(sp32)
            const data = getMemoryContent(sp)
            for (let i = 0; i < 4; i++) {
               flagArray[i] = (data[28 + i] === '1')
            }
            sp32 = add32(sp32, '00000000000000000000000000000001').result
            setRegisterValue(29, sp32)
            // pop %pc
            sp32 = getRegisterValue(29)
            sp = bin32ToUnsigned(sp32)
            const pcBin32 = getMemoryContent(sp)
            setRegisterValue(30, pcBin32)
            sp32 = add32(sp32, '00000000000000000000000000000001').result
            setRegisterValue(29, sp32)
            setCurrentAddress(bin32ToUnsigned(pcBin32))
         }
      } else if (currentLine.synthetic) {
         if (currentLine.synthetic.type === 'clr') {
            setRegisterValue(currentLine.synthetic.rd, '00000000000000000000000000000000')
            setCurrentAddress(currentAddress + 1)
         } else if (currentLine.synthetic.type === 'mov') {
            setRegisterValue(currentLine.synthetic.rd, getRegisterValue(currentLine.synthetic.rs))
            setCurrentAddress(currentAddress + 1)
         } else if (currentLine.synthetic.type === 'inc') {
            const rdContent = getRegisterValue(currentLine.synthetic.rd)
            const rdValue = bin32ToSigned(rdContent)
            setRegisterValue(currentLine.synthetic.rd, signedToBin32(rdValue + 1))
            setCurrentAddress(currentAddress + 1)
         } else if (currentLine.synthetic.type === 'inccc') {
            const rdContent = getRegisterValue(currentLine.synthetic.rd)
            const rdValue = bin32ToSigned(rdContent)
            setRegisterValue(currentLine.synthetic.rd, signedToBin32(rdValue + 1))
            setFlag(0, rdValue + 1 < 0)
            setFlag(1, rdValue + 1 === 0)
            setFlag(2, rdValue === 2147483647)
            setFlag(3, rdValue === 4294967295)
            setCurrentAddress(currentAddress + 1)
         } else if (currentLine.synthetic.type === 'dec') {
            const rdContent = getRegisterValue(currentLine.synthetic.rd)
            const rdValue = bin32ToSigned(rdContent)
            setRegisterValue(currentLine.synthetic.rd, signedToBin32(rdValue - 1))
            setCurrentAddress(currentAddress + 1)
         } else if (currentLine.synthetic.type === 'deccc') {
            const rdContent = getRegisterValue(currentLine.synthetic.rd)
            const rdValue = bin32ToSigned(rdContent)
            setRegisterValue(currentLine.synthetic.rd, signedToBin32(rdValue - 1))
            setFlag(0, rdValue - 1 < 0)
            setFlag(1, rdValue - 1 === 0)
            setFlag(2, rdValue === -2147483648)
            setFlag(3, rdValue === -4294967296)
            setCurrentAddress(currentAddress + 1)
         } else if (currentLine.synthetic.type === 'setq') {
            const simm13Value = signedToBin32(currentLine.synthetic.simm13)
            setRegisterValue(currentLine.synthetic.rd, simm13Value)
            setCurrentAddress(currentAddress + 1)
         } else if (currentLine.synthetic.type === 'set') {
            const simm32Value = signedToBin32(currentLine.synthetic.simm32)
            setRegisterValue(currentLine.synthetic.rd, simm32Value)
            setCurrentAddress(currentAddress + 2)
         } else if (currentLine.synthetic.type === 'cmp') {
            const rsValueSigned = bin32ToSigned(getRegisterValue(currentLine.synthetic.rs))
            const rsValueUnsigned = bin32ToUnsigned(getRegisterValue(currentLine.synthetic.rs))
            if (currentLine.synthetic.rd !== undefined) {
               const rdValueSigned = bin32ToSigned(getRegisterValue(currentLine.synthetic.rd))
               const rdValueUnsigned = bin32ToUnsigned(getRegisterValue(currentLine.synthetic.rd))
               //console.log('rdValueSigned', rdValueSigned, 'rsValueSigned', rsValueSigned)
               const diffSigned = rsValueSigned - rdValueSigned
               setFlag(0, diffSigned < 0) // N
               setFlag(1, diffSigned === 0) // Z
               setFlag(2, rsValueSigned < 0 && rdValueSigned >= 0 && diffSigned >= 0 || rsValueSigned >= 0 && rdValueSigned < 0 && diffSigned < 0) // V
               setFlag(3, rsValueUnsigned < rdValueUnsigned) // C
            } else {
               const diffSigned = rsValueSigned - currentLine.synthetic.simm13
               setFlag(0, diffSigned < 0) // N
               setFlag(1, diffSigned === 0) // Z
               setFlag(2, rsValueSigned < 0 && currentLine.synthetic.simm13 >= 0 && diffSigned >= 0 || rsValueSigned >= 0 && currentLine.synthetic.simm13 < 0 && diffSigned < 0) // V
               setFlag(3, diffSigned < 0) // C ????
            }
            setCurrentAddress(currentAddress + 1)
         } else if (currentLine.synthetic.type === 'tst') {
            const rsValueSigned = bin32ToSigned(getRegisterValue(currentLine.synthetic.rs))
            const rsValueUnsigned = bin32ToUnsigned(getRegisterValue(currentLine.synthetic.rs))
            setFlag(0, rsValueSigned < 0) // N
            setFlag(1, rsValueSigned === 0) // Z
            setFlag(2, false) // V
            setFlag(3, false) // C
            setCurrentAddress(currentAddress + 1)
         } else if (currentLine.synthetic.type === 'negcc') {
            const rdValueSigned = bin32ToSigned(getRegisterValue(currentLine.synthetic.rd))
            setRegisterValue(currentLine.synthetic.rd, signedToBin32(-rdValueSigned))
            setFlag(0, -rdValueSigned < 0) // N
            setFlag(1, rdValueSigned === 0) // Z
            setFlag(2, false) // V
            setFlag(3, false) // C
            setCurrentAddress(currentAddress + 1)
         } else if (currentLine.synthetic.type === 'nop') {
            setCurrentAddress(currentAddress + 1)
         } else if (currentLine.synthetic.type === 'call') {
            setRegisterValue(28, getRegisterValue(30))
            setCurrentAddress(currentAddress + currentLine.synthetic.disp + 1)
         } else if (currentLine.synthetic.type === 'ret') {
            const r28 = bin32ToUnsigned(getRegisterValue(28))
            const returnAddress = r28 + 2
            setRegisterValue(30, unsignedToBin32(returnAddress))
            setCurrentAddress(returnAddress)
         } else if (currentLine.synthetic.type === 'push') {
            const sp32 = sub32(getRegisterValue(29), '00000000000000000000000000000001').result
            setRegisterValue(29, sp32)
            const sp = bin32ToUnsigned(sp32)
            setMemoryContent(sp, getRegisterValue(currentLine.synthetic.rs))
            setCurrentAddress(currentAddress + 2)
         } else if (currentLine.synthetic.type === 'pop') {
            let sp32 = getRegisterValue(29)
            const sp = bin32ToUnsigned(sp32)
            setRegisterValue(currentLine.synthetic.rd, getMemoryContent(sp))
            sp32 = add32(sp32, '00000000000000000000000000000001').result
            setRegisterValue(29, sp32)
            setCurrentAddress(currentAddress + 2)
         }
      }
      return({
         currentAddress, memoryDict, registerDict, switchArray, flagArray, ledArray, it,
      })
   }

   function setCurrentAddress(address) {
      setRegisterValue(30, unsignedToBin32(address))
      const content = memoryDict[address]
      if (!content) {
         const cause = 6
         throw new Error(`programe counter at uninitialized memory address 0x${address.toString(16)}`, { cause })
      }
      currentAddress = address
   }


   function getRegisterValue(regno) {
      if (regno === 0) {
         return '00000000000000000000000000000000'
      } else {
         return registerDict[regno]
      }
   }

   function setRegisterValue(regno, bin32Value) {
      if (regno > 0) {
         registerDict[regno] = bin32Value
      }
   }

   function getMemoryContent(address) {
      if (address < 0x10000000) {
         const memoryEntry = memoryDict[address]
         if (!memoryEntry) {
            const cause = 4
            throw new Error(`read-access to uninitialized memory location 0x${address.toString(16)}`, { cause })
         }
         //console.log('getMemoryContent', address, memoryEntry.value)
         return memoryEntry.value
      } else if (address === 0x90000000) {
         let result = ''
         for (let i = 31; i >= 0; i--) {
            if (i > 16) {
               result += '0'
            } else {
               result += (switchArray[i] ? '1' : '0')
            }
         }
         return result
      } else {
         const cause = 7
         throw new Error(`read-access to unmapped memory location 0x${address.toString(16)}`, { cause })
      }
   }

   function setMemoryContent(address, content) {
      //console.log('setMemoryContent', address, content)
      if (address < 0x10000000) {
         const memoryEntry = { text: '', label: '', value: content }
         memoryDict[address] = memoryEntry
      } else if (address === 0xB0000000) {
         for (let i = 0; i < 16; i++) {
            const bit = content.charAt(31-i)
            ledArray[i] = (bit==='1')
         }
      } else {
         const cause = 5
         throw new Error(`write-access to unmapped memory location 0x${address.toString(16)}`, { cause })
      }
   }

   // 0123: NZVC
   function getFlag(flagIndex) {
      return flagArray.indexOf(flagIndex) !== -1
   }

   function setFlag(flag, value) {
      if (value) {
         if (flagArray.indexOf(flag) === -1) {
            flagArray.push(flag)
         }
      } else {
         const index = flagArray.indexOf(flag)
         if (index !== -1) {
            flagArray.splice(index, 1)
         }
      }
   }

   function evalCondition(instruction) {
      if (instruction.cond === 'a') {
         return true
      } else if (instruction.cond === 'z' || instruction.cond === 'e' || instruction.cond === 'eq') {
         const Z = getFlag(1)
         return Z
      } else if (instruction.cond === 'nz' || instruction.cond === 'ne') {
         const Z = getFlag(1)
         return !Z
      } else if (instruction.cond === 'neg' || instruction.cond === 'n') {
         const N = getFlag(0)
         return N
      } else if (instruction.cond === 'pos' || instruction.cond === 'nn') {
         const N = getFlag(0)
         return !N
      } else if (instruction.cond === 'cs' || instruction.cond === 'lu') {
         const C = getFlag(3)
         return C
      } else if (instruction.cond === 'cc' || instruction.cond === 'geu') {
         const C = getFlag(3)
         return !C
      } else if (instruction.cond === 'g' || instruction.cond === 'gt') {
         const N = getFlag(0)
         const Z = getFlag(1)
         const V = getFlag(2)
         return !(Z || (N !== V))
      } else if (instruction.cond === 'ge') {
         const N = getFlag(0)
         const V = getFlag(2)
         return N === V
      } else if (instruction.cond === 'l' || instruction.cond === 'lt') {
         const N = getFlag(0)
         const V = getFlag(2)
         return N !== V
      } else if (instruction.cond === 'le') {
         const N = getFlag(0)
         const Z = getFlag(1)
         const V = getFlag(2)
         return (Z || (N !== V))
      } else if (instruction.cond === 'gu') {
         const Z = getFlag(1)
         const C = getFlag(3)
         return !(Z || C)
      } else if (instruction.cond === 'leu') {
         const Z = getFlag(1)
         const C = getFlag(3)
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
            setFlag(0, result.charAt(0) === '1') // N
            setFlag(1, result.indexOf('1') === -1) // Z
            setFlag(2, V) // V
            setFlag(3, C) // C
         }
      } else if (codeop === 'umulcc') {
         const varg1 = bin16ToUnsigned(arg1.substring(16))
         const varg2 = bin16ToUnsigned(arg2.substring(16))
         result = unsignedToBin32(varg1 * varg2)
         // set N,Z
         setFlag(0, result.charAt(0) === '1') // N
         setFlag(1, result.indexOf('1') === -1) // Z
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
            setFlag(0, result.charAt(0) === '1') // N
            setFlag(1, result.indexOf('1') === -1) // Z
         }
      } else if (codeop === 'slr') {
         result = slr32(arg1, arg2)
      } else if (codeop === 'sll') {
         result = sll32(arg1, arg2)
      }
      return result
   }

}
