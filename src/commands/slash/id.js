const { MessageActionRow, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'id',
    description: 'Generates a room ID and password.',
    async execute(interaction) {
        // Generate room ID and password
        const roomId = Math.floor(100000 + Math.random() * 900000); // random ID
        const roomPassword = Math.random().toString(36).slice(-8); // random password

        // Create buttons
        const row = new MessageActionRow()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('copy_id')
                    .setLabel('Copiar ID')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('call_admin')
                    .setLabel('Chamar ADM')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('recreate_room')
                    .setLabel('Recriar Sala')
                    .setStyle(ButtonStyle.Danger)
            );

        // Respond with the room ID and password
        await interaction.reply({
            content: `Room ID: ${roomId}\nPassword: ${roomPassword}`,
            components: [row],
        });
    },
};