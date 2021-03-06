import { useTokenContract, useTokenContractWeb3 } from '../../../utils/web3/web3Utils'
// import { BigNumber } from '@ethersproject/bignumber'
import COIN_ABI from '../../../utils/web3/coinABI'
import { sendTransactionEvent, useContractMethods } from '../../../utils/web3/contractEvent'
import { keepPoint, numDiv, timeToDate1, milliFormat } from '../../../utils/function'

let that
export default {
  data () {
    return {
      tokenContract: null,
      account: '',
      tradeTab: {
        list: [{
          currency: 'HBTC',
          contract: process.env.options_HBTC
        }, {
          currency: 'HETH',
          contract: process.env.options_HBTC
        }, {
          currency: 'HT',
          contract: process.env.options_HT
        }],
        index: 0
      },
      items: ['1day', '1week(7days)', '2week(14days)', '3week(21days)', '4week(28days)'],
      holdTime: {
        '1day': 1,
        '1week(7days)': 7,
        '2week(14days)': 14,
        '3week(21days)': 21,
        '4week(28days)': 28
      },
      optionSizePlaceholder: '1',
      strikePricePlaceholder: '0',
      optionsType: '1',
      tradeForm: {
        optionSize: '',
        strikePrice: '',
        selectList: ['1day', '1week(7days)', '2week(14days)', '3week(21days)', '4week(28days)'],
        hold: '1day'
      },
      fees: {
        strikePrice: 0,
        totalCost: 0,
        breakEven: 0
      },
      contractTab: {
        list: ['ACTIVE', 'HISTORY'],
        index: 0
      },
      contractHead: ['Type', 'Size', 'Strike Price', 'Price Now', 'Break-even', 'P&L', 'Placed At', 'Expires in', 'Exercise', 'Share'],
      contractDataList: [],
      price_HT: 0,
      getHTAmount: 0,
      getPutClass: ''
    }
  },
  // computed: {
  //   getPutClass: function () {
  //     if (parseFloat(this.price_HT) > parseFloat(this.fees.strikePrice) && parseFloat(this.fees.strikePrice) > parseFloat(this.fees.breakEven)) {
  //       return 'top'
  //     } else if (parseFloat(this.fees.strikePrice) > parseFloat(this.price_HT) || parseFloat(this.fees.breakEven) > parseFloat(this.price_HT)) {
  //       return 'bottom'
  //     } else {
  //       return ''
  //     }
  //   }
  // },
  watch: {
    // ???????????????????????????fee
    'tradeForm.hold': function (val) {
      console.log(val)
      this.getFees()
    },
    // ???????????????????????????fee
    optionsType: function (val) {
      console.log(val)
      this.getFees()
    }
  },
  mounted () {
    this.initPage()
  },
  methods: {
    millHTAmount (num) {
      return parseFloat(keepPoint(num, 6))
    },
    // ?????????????????????
    changeTradeTab (i) {
      this.tradeTab.index = i
      this.getFees()
      this.getContractDataList()
    },
    // ?????????????????????????????????
    changeContractTab (i) {
      this.contractTab.index = i
    },
    changeVal (val) {
      this.getFees()
    },
    // fee ????????????????????????????????????
    async getFees () {
      console.log(!this.tradeForm.strikePrice || !this.tradeForm.optionSize)
      const strikePrice = this.tradeForm.strikePrice || this.strikePricePlaceholder
      const optionSize = this.tradeForm.optionSize || this.optionSizePlaceholder
      const price = await this.getPrice()
      console.log(price)
      // if (!this.tradeForm.strikePrice || !this.tradeForm.optionSize) {
      //   return
      // }
      console.log(strikePrice, optionSize)
      const current_currency = this.tradeTab.list[this.tradeTab.index]
      console.log(current_currency.contract)
      const currentPrice = price[`price_${current_currency.currency}`]
      const contract = current_currency.contract
      const tokenContract = useTokenContract(contract, COIN_ABI[`futures_${current_currency.currency}`])
      // const tokenContract = useTokenContractWeb3(COIN_ABI[`futures_${current_currency.currency}`], contract)
      try {
        const fees = await this.getFeesResult(
          tokenContract,
          this.holdTime[this.tradeForm.hold] * 24 * 60 * 60,
          optionSize,
          strikePrice,
          this.optionsType)
        console.log(fees)
        this.fees = {
          total: fees.total.toString(),
          settlementFee: fees.settlementFee.toString(),
          strikeFee: fees.strikeFee.toString(),
          periodFee: fees.periodFee.toString(),
          strikePrice: parseFloat(strikePrice),
          totalFee: parseFloat(this.$web3_http.utils.fromWei(fees.total.toString(), 'ether'))
        }
        this.fees.totalCost = parseFloat(this.keepPoint(currentPrice * this.fees.totalFee, 4))
        // PUT ??????
        if (this.optionsType === '1') {
          // this.fees.breakEven = parseFloat(this.keepPoint(strikePrice + (this.fees.totalCost / optionSize), 4))
          this.fees.breakEven = parseFloat(this.keepPoint(parseFloat(strikePrice) + (this.fees.totalCost / optionSize), 4))
        } else {
          this.fees.breakEven = parseFloat(this.keepPoint(strikePrice - (this.fees.totalCost / optionSize), 4))
        }
        // this.getHTAmount = parseFloat(keepPoint(numDiv(this.fees.totalCost, price[this.tradeTab.list[this.tradeTab.index].currency]), 4))
        console.log(this.fees)

        if (parseFloat(this.price_HT) > parseFloat(this.fees.strikePrice) && parseFloat(this.fees.strikePrice) > parseFloat(this.fees.breakEven)) {
          this.getPutClass = 'top'
        } else if (parseFloat(this.fees.strikePrice) > parseFloat(this.price_HT) || parseFloat(this.fees.breakEven) > parseFloat(this.price_HT)) {
          this.getPutClass = 'bottom'
        } else {
          this.getPutClass = ''
        }
      } catch (e) {
        console.log(e)
      }
    },
    // ??????fee????????????
    async getFeesResult (tokenContract, hold, optionSize, strikePrice, optionsType) {
      strikePrice = this.toWei8(strikePrice)
      if (this.tradeTab.list[this.tradeTab.index].currency === 'HBTC') {
        optionSize = this.toWei8(optionSize)
      } else {
        optionSize = this.$web3_http.utils.toWei(optionSize)
      }
      console.log(hold,
        optionSize,
        strikePrice,
        optionsType)
      try {
        const fees = await tokenContract.fees(
          hold,
          optionSize,
          strikePrice,
          optionsType)
        console.log({
          total: fees.total.toString(),
          settlementFee: fees.settlementFee.toString(),
          strikeFee: fees.strikeFee.toString(),
          periodFee: fees.periodFee.toString(),
          strikePrice: strikePrice,
          totalFee: fees.total.toString()
        })
        console.log(fees)
        return fees
      } catch (e) {
        console.log(e)
        return null
      }
    },
    // buy contract options
    async buyOptions () {
      if (!this.tradeForm.strikePrice || !this.tradeForm.optionSize) {
        return
      }
      const contract = this.tradeTab.list[this.tradeTab.index].contract
      const tokenContract = useTokenContractWeb3(COIN_ABI.futures_HT, contract)
      sendTransactionEvent(
        tokenContract.methods.create(
          this.holdTime[this.tradeForm.hold] * 24 * 60 * 60,
          that.$web3_http.utils.toWei(that.tradeForm.optionSize),
          // this.$web3_http.utils.toWei(this.tradeForm.strikePrice, 'ether'),
          this.toWei8(this.tradeForm.strikePrice),
          this.optionsType)
          .send({
            from: that.account,
            value: that.$web3_http.utils.toWei(that.fees.totalFee.toString())
          }), {
          summary: `create ${that.amount}`
        }, function () {
          that.getContractDataList()
        })
    },
    async connectWallet () {
      const init_wab3 = await this.initWeb3()
      console.log(init_wab3)
      that.$toastBox.showToastBox({
        type: 'none',
        text: init_wab3.message
      })
    },
    setAccount () {
      this.initPage()
    },
    async initPage () {
      that = this
      if (that.$account) {
        that.account = that.$account
        const price = await this.getPrice()
        that.price_HT = price.price_HT
        that.strikePricePlaceholder = that.price_HT.toString()
        this.getFees()
        that.getContractDataList()
      }
    },
    // ?????? getTransaction input ???????????????
    async decodeParamsOfCreate (txHash, func_abi) {
      func_abi = func_abi || [{ internalType: 'uint256', name: 'period', type: 'uint256' }, {
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256'
      }, { internalType: 'uint256', name: 'strike', type: 'uint256' }, {
        internalType: 'enum ISeaweedOptions.OptionType',
        name: 'optionType',
        type: 'uint8'
      }]
      const txData = await this.$web3_http.eth.getTransaction(txHash)
      const input = '0x' + txData.input.substr(10)
      return this.$web3_http.eth.abi.decodeParameters(func_abi, input)
    },
    // ??????????????????
    async getContractDataList () {
      const current_currency = this.tradeTab.list[this.tradeTab.index]
      const contract = current_currency.contract
      const tokenContract = useTokenContract(contract, COIN_ABI[`futures_${current_currency.currency}`])
      const event = tokenContract.interface.events
      console.log(event)
      const lastBlock = await this.$web3_http.eth.getBlock('latest')
      const logs = await this.$library.getLogs({
        fromBlock: lastBlock.number - 5000,
        toBlock: lastBlock.number,
        address: contract
      })
      console.log(logs)
      that.contractDataList = []
      for (let i = 0; i < logs.length; i++) {
        try {
          const createParams = await this.decodeParamsOfCreate(logs[i].transactionHash)
          const optionId = parseInt(logs[i].topics[1])
          const options = await tokenContract.options(optionId)
          const strikePrice = this.$web3_http.utils.fromWei(options.strike.toString())
          const input = await this.$web3_http.eth.abi.decodeLog([
            { indexed: true, internalType: 'uint256', name: 'id', type: 'uint256' },
            {
              indexed: true,
              internalType: 'address',
              name: 'account',
              type: 'address'
            },
            { indexed: false, internalType: 'uint256', name: 'settlementFee', type: 'uint256' },
            {
              indexed: false,
              internalType: 'uint256',
              name: 'totalFee',
              type: 'uint256'
            }],
          logs[i].data,
          logs[i].topics)
          console.log(input)
          const fees = await this.getFeesResult(tokenContract, createParams.period, options.amount.toString(), strikePrice, options.optionType)
          const totalFee = parseFloat(this.$web3_http.utils.fromWei(fees.total.toString(), 'ether'))
          const totalCost = parseFloat(this.keepPoint(this.price_HT * totalFee, 2))
          let breakEven = 0
          if (options.optionType === 1) {
            breakEven = parseFloat(this.keepPoint(strikePrice + (totalCost / options.amount.toString()), 2))
          } else {
            breakEven = parseFloat(this.keepPoint(strikePrice - (totalCost / options.amount.toString()), 2))
          }
          that.contractDataList.push({
            type: options.optionType === 2 ? 'CALL' : 'PUT',
            size: `${that.$web3_http.utils.fromWei(options.amount.toString())} ${current_currency.currency}`,
            strikePrice,
            nowPrice: 235.1,
            breakEven: breakEven,
            PL: 12,
            placedAt: `${logs[i].address.substr(0, 3)}...${logs[i].address.substr(logs[i].address.length - 4, logs[i].address.length)}`,
            expireIn: timeToDate1(options.expiration),
            expiration: options.expiration,
            exercise: 1,
            share: 90,
            optionId
          })
        } catch (e) {
          console.log(e)
        }
      }
    },
    // ??????????????????
    async exercise (v) {
      const that = this
      const current_currency = this.tradeTab.list[this.tradeTab.index]
      const contract = current_currency.contract
      const tokenContract = useTokenContract(contract, COIN_ABI[`futures_${current_currency.currency}`])
      await useContractMethods({
        contract: tokenContract,
        methodName: 'exercise',
        parameters: [
          v.optionId
        ],
        callback: function () {
          that.getContractDataList()
        }
      })
    }
  }
}
