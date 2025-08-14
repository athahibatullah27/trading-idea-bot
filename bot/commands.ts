import { SlashCommandBuilder } from 'discord.js';

export const commands = [
  new SlashCommandBuilder()
    .setName('tradingidea')
    .setDescription('Get AI-powered trading recommendations with real-time market analysis'),
  
  new SlashCommandBuilder()
    .setName('market')
    .setDescription('View current market overview and conditions'),
  
  new SlashCommandBuilder()
    .setName('crypto')
    .setDescription('Get technical analysis for a specific cryptocurrency')
    .addStringOption(option =>
      option.setName('symbol')
        .setDescription('Cryptocurrency symbol (e.g., BTC, ETH, SOL, ADA)')
        .setRequired(true)
        .addChoices(
          { name: 'Bitcoin (BTC)', value: 'BTC' },
          { name: 'Ethereum (ETH)', value: 'ETH' },
          { name: 'Solana (SOL)', value: 'SOL' },
          { name: 'Cardano (ADA)', value: 'ADA' },
          { name: 'Binance Coin (BNB)', value: 'BNB' },
          { name: 'Ripple (XRP)', value: 'XRP' }
        )
    ),
  
  new SlashCommandBuilder()
    .setName('price')
    .setDescription('Get quick price information for a cryptocurrency')
    .addStringOption(option =>
      option.setName('symbol')
        .setDescription('Cryptocurrency symbol (e.g., BTC, ETH, SOL)')
        .setRequired(true)
        .addChoices(
          { name: 'Bitcoin (BTC)', value: 'BTC' },
          { name: 'Ethereum (ETH)', value: 'ETH' },
          { name: 'Solana (SOL)', value: 'SOL' },
          { name: 'Cardano (ADA)', value: 'ADA' },
          { name: 'Binance Coin (BNB)', value: 'BNB' },
          { name: 'Ripple (XRP)', value: 'XRP' }
        )
    ),
  
  new SlashCommandBuilder()
    .setName('news')
    .setDescription('Get latest crypto news with sentiment analysis'),
  
  new SlashCommandBuilder()
    .setName('test')
    .setDescription('Test API connectivity and bot status'),
  
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show available commands and how to use them')
];