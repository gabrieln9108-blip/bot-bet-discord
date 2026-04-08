const { SlashCommandBuilder } = require('discord.js');

module.exports = { 
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Owner Panel for the bot')
        .addStringOption(option =>
            option
                .setName('menu')
                .setDescription('Select a menu')
                .setRequired(true)
                .addChoice('DASHBOARD', 'dashboard')
                .addChoice('FINANCEIRO', 'financeiro')
                .addChoice('FILAS', 'filas')
                .addChoice('MEDIADORES', 'mediadores')
                .addChoice('APOSTAS', 'apostas')
                .addChoice('LOGS', 'logs')
                .addChoice('SEGURANÇA', 'seguranca')
                .addChoice('SISTEMA', 'sistema')
                .addChoice('USUÁRIOS', 'usuarios')
                .addChoice('RANKING', 'ranking')
                .addChoice('INTEGRAÇÕES', 'integracoes')
                .addChoice('EMERGÊNCIA', 'emergencia')
        ),

    async execute(interaction) {
        const menu = interaction.options.getString('menu');
        switch(menu) {
            case 'dashboard':
                // Implement functionality for DASHBOARD
                await interaction.reply('Displaying Dashboard functionality.');
                break;
            case 'financeiro':
                // Implement functionality for FINANCEIRO
                await interaction.reply('Displaying Financeiro functionality.');
                break;
            case 'filas':
                // Implement functionality for FILAS
                await interaction.reply('Displaying Filas functionality.');
                break;
            case 'mediadores':
                // Implement functionality for MEDIADORES
                await interaction.reply('Displaying Mediadores functionality.');
                break;
            case 'apostas':
                // Implement functionality for APOSTAS
                await interaction.reply('Displaying Apostas functionality.');
                break;
            case 'logs':
                // Implement functionality for LOGS
                await interaction.reply('Displaying Logs functionality.');
                break;
            case 'seguranca':
                // Implement functionality for SEGURANÇA
                await interaction.reply('Displaying Seguranca functionality.');
                break;
            case 'sistema':
                // Implement functionality for SISTEMA
                await interaction.reply('Displaying Sistema functionality.');
                break;
            case 'usuarios':
                // Implement functionality for USUÁRIOS
                await interaction.reply('Displaying Usuarios functionality.');
                break;
            case 'ranking':
                // Implement functionality for RANKING
                await interaction.reply('Displaying Ranking functionality.');
                break;
            case 'integracoes':
                // Implement functionality for INTEGRAÇÕES
                await interaction.reply('Displaying Integracoes functionality.');
                break;
            case 'emergencia':
                // Implement functionality for EMERGÊNCIA
                await interaction.reply('Displaying Emergencia functionality.');
                break;
            default:
                await interaction.reply('Menu not found.');
                break;
        }
    },
};