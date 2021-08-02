/*










                              BURADA
                              HİÇBİR
                              ŞEYE
                              DOKUNMAYIN










*/
const { Client, RichEmbed, Emoji, MessageReaction } = require('discord.js');
const CONFIG = require('./config');

const client = new Client({ disableEveryone: true });

client.login(CONFIG.botToken);

if (CONFIG.roles.length !== CONFIG.reactions.length)
    throw "Girdiğiniz rol sayısı ile emoji sayısı aynı sayıda değil! Lütfen config.js dosyasında bu ayarları yapın.";

function generateMessages() {
    return CONFIG.roles.map((r, e) => {
        return {
            role: r,
            message: `**"${r}"** rolünü almak için aşağıdaki emojiye tıklayınız.!`,
            emoji: CONFIG.reactions[e]
        };
    });
}

function generateEmbedFields() {
    return CONFIG.roles.map((r, e) => {
        return {
            emoji: CONFIG.reactions[e],
            role: r
        };
    });
}

client.on("ready", () => console.log("Emoji-rol sistemi açıldı!"));
client.on('error', console.error);

client.on("message", message => {
    if (message.author.bot) return;

    if (!message.guild) return;

    if (message.guild && !message.channel.permissionsFor(message.guild.me).missing('SEND_MESSAGES')) return;

    if ((message.author.id !== CONFIG.yourID) && (message.content.toLowerCase() !== CONFIG.setupCMD)) return;

    if (CONFIG.deleteSetupCMD) {
        const missing = message.channel.permissionsFor(message.guild.me).missing('MANAGE_MESSAGES');
        if (missing.includes('MANAGE_MESSAGES'))
            throw new Error("Mesajları yönetme yetkisine ihtiyacım var, lütfen bu yetkiyi bana verin!");
        message.delete().catch(O_o=>{});
    }

    const missing = message.channel.permissionsFor(message.guild.me).missing('MANAGE_MESSAGES');
    if (missing.includes('ADD_REACTIONS'))
        throw new Error("Mesajları yönetme yetkisine ihtiyacım var, lütfen bu yetkiyi bana verin!");

    if (!CONFIG.embed) {
        if (!CONFIG.initialMessage || (CONFIG.initialMessage === '')) 
            throw "config.js dosyasında 'initialMessage' ayarını yapılandırın!";

        message.channel.send(CONFIG.initialMessage);

        const messages = generateMessages();
        for (const { role, message: msg, emoji } of messages) {
            if (!message.guild.roles.find(r => r.name === role))
                throw `The role '${role}' does not exist!`;

            message.channel.send(msg).then(async m => {
                const customCheck = message.guild.emojis.find(e => e.name === emoji);
                if (!customCheck) await m.react(emoji);
                else await m.react(customCheck.id);
            }).catch(console.error);
        }
    } else {
        if (!CONFIG.embedMessage || (CONFIG.embedMessage === ''))
            throw "config.js dosyasında 'embedMessage' ayarını yapılandırın!";
        if (!CONFIG.embedFooter || (CONFIG.embedMessage === ''))
            throw "config.js dosyasında 'embedFooter' ayarını yapılandırın!";

        const roleEmbed = new RichEmbed()
            .setDescription(CONFIG.embedMessage)
            .setFooter(CONFIG.embedFooter);

        if (CONFIG.embedColor) roleEmbed.setColor(CONFIG.embedColor);

        if (CONFIG.embedThumbnail && (CONFIG.embedThumbnailLink !== '')) 
            roleEmbed.setThumbnail(CONFIG.embedThumbnailLink);
        else if (CONFIG.embedThumbnail && message.guild.icon)
            roleEmbed.setThumbnail(message.guild.iconURL);

        const fields = generateEmbedFields();
        if (fields.length > 25) throw "Bir embeda en fazla 25 rol koyulabilir!";

        for (const { emoji, role } of fields) {
            if (!message.guild.roles.find(r => r.name === role))
                throw `The role '${role}' does not exist!`;

            const customEmote = client.emojis.find(e => e.name === emoji);
            
            if (!customEmote) roleEmbed.addField(emoji, role, true);
            else roleEmbed.addField(customEmote, role, true);
        }

        message.channel.send(roleEmbed).then(async m => {
            for (const r of CONFIG.reactions) {
                const emoji = r;
                const customCheck = client.emojis.find(e => e.name === emoji);
                
                if (!customCheck) await m.react(emoji);
                else await m.react(customCheck.id);
            }
        });
    }
});

const events = {
	MESSAGE_REACTION_ADD: 'messageReactionAdd',
	MESSAGE_REACTION_REMOVE: 'messageReactionRemove',
};

client.on('raw', async event => {
    if (!events.hasOwnProperty(event.t)) return;

    const { d: data } = event;
    const user = client.users.get(data.user_id);
    const channel = client.channels.get(data.channel_id);

    const message = await channel.fetchMessage(data.message_id);
    const member = message.guild.members.get(user.id);

    const emojiKey = (data.emoji.id) ? `${data.emoji.name}:${data.emoji.id}` : data.emoji.name;
    let reaction = message.reactions.get(emojiKey);

    if (!reaction) {
        const emoji = new Emoji(client.guilds.get(data.guild_id), data.emoji);
        reaction = new MessageReaction(message, emoji, 1, data.user_id === client.user.id);
    }

    let embedFooterText;
    if (message.embeds[0]) embedFooterText = message.embeds[0].footer.text;

    if (
        (message.author.id === client.user.id) && (message.content !== CONFIG.initialMessage || 
        (message.embeds[0] && (embedFooterText !== CONFIG.embedFooter)))
    ) {

        if (!CONFIG.embed && (message.embeds.length < 1)) {
            const re = `\\*\\*"(.+)?(?="\\*\\*)`;
            const role = message.content.match(re)[1];

            if (member.id !== client.user.id) {
                const guildRole = message.guild.roles.find(r => r.name === role);
                if (event.t === "MESSAGE_REACTION_ADD") member.addRole(guildRole.id);
                else if (event.t === "MESSAGE_REACTION_REMOVE") member.removeRole(guildRole.id);
            }
        } else if (CONFIG.embed && (message.embeds.length >= 1)) {
            const fields = message.embeds[0].fields;

            for (const { name, value } of fields) {
                if (member.id !== client.user.id) {
                    const guildRole = message.guild.roles.find(r => r.name === value);
                    if ((name === reaction.emoji.name) || (name === reaction.emoji.toString())) {
                        if (event.t === "MESSAGE_REACTION_ADD") member.addRole(guildRole.id);
                        else if (event.t === "MESSAGE_REACTION_REMOVE") member.removeRole(guildRole.id);
                    }
                }
            }
        }
    }
});

process.on('unhandledRejection', err => {
    const msg = err.stack.replace(new RegExp(`${__dirname}/`, 'g'), './');
	console.error("Unhandled Rejection", msg);
});
