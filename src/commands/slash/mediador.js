const { MessageActionRow, MessageButton } = require('discord.js');

module.exports = {
    data: {
        name: 'mediador',
        description: 'Financial panel for mediator'
    },
    async execute(interaction) {
        const row = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId('sacar')
                    .setLabel('Sacar')
                    .setStyle('PRIMARY'),
                new MessageButton()
                    .setCustomId('ver_saldo')
                    .setLabel('Ver Saldo')
                    .setStyle('SECONDARY')
            );

        await interaction.reply({ content: 'Escolha uma ação:', components: [row] });
    },
};