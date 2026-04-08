const { Modal, TextInputComponent, ModalSubmitInteraction } = require('discord-modals');
const { MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');

let queues = {};

async function createQueue(interaction) {
    const modal = new Modal()
        .setCustomId('createQueueModal')
        .setTitle('Create Queue')
        .addComponents(
            new TextInputComponent()
                .setCustomId('queueName')
                .setLabel('Queue Name')
                .setStyle('SHORT'),
            new TextInputComponent()
                .setCustomId('queueMode')
                .setLabel('Queue Mode')
                .setStyle('SHORT'),
            new TextInputComponent()
                .setCustomId('queueValues')
                .setLabel('Values (comma separated)')
                .setStyle('LONG')
        );

    await interaction.showModal(modal);
}

async function handleQueueCreation(interaction) {
    const { fields } = interaction;
    const queueName = fields.getTextInputValue('queueName');
    const queueMode = fields.getTextInputValue('queueMode');
    const queueValues = fields.getTextInputValue('queueValues').split(',');

    queues[queueName] = { mode: queueMode, values: queueValues, participants: [] };

    await interaction.reply(`Queue ${queueName} created!`);
}

async function publishQueue(interaction, queueName) {
    const queue = queues[queueName];
    const embeds = queue.values.map(value => {
        return new MessageEmbed()
            .setTitle(value)
            .setDescription(`Join or leave this queue`);
    });

    const rows = queue.values.map((value, index) => {
        return new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId(`join_${index}`)
                    .setLabel('Join')
                    .setStyle('PRIMARY'),
                new MessageButton()
                    .setCustomId(`leave_${index}`)
                    .setLabel('Leave')
                    .setStyle('DANGER')
            );
    });

    for (let i = 0; i < embeds.length; i++) {
        await interaction.channel.send({ embeds: [embeds[i]], components: [rows[i]] });
    }
}

module.exports = {
    createQueue,
    handleQueueCreation,
    publishQueue
};
