const ircd = require('./ircd.js');
const Discord = require('discord.js');
const client = new Discord.Client();
const md5 = require('md5');
const fs = require('fs');
const url = require('url');

Discord.User.prototype._setup = Discord.User.prototype.setup;
Discord.User.prototype.setup = function setup(data) {
	this._setup(data);
	this.displayName = data.global_name || data.username;
};

// Discord.js v12+ compatibility
if(Discord.ChannelManager)
	Discord.ChannelManager.prototype.get = function get(id) {
		return this.cache.get(id);
	};
	
const config = require('./discord-irc.json');

const irc = ircd.Server.boot({
	network: 'ircn',
	hostname: config.host || '0.0.0.0',
	serverDescription: 'A Node IRC daemon',
	serverName: 'server1',
	motd: config.motd || '',
	port: config.port || 6667,
	whoWasLimit: 10000,
	maxNickLength: 999,
	opers: {
	},
	onMessage: onIRCMessage,
	onJoin: onIRCChannelJoin,
});

const webhooks = {}, users = {};

function filter(username) {
	return username.replace(/\s/g, '_').replace(/\:/g, '_').replace(/\!/g, '_').replace(/\?/g, '_').replace(/[@]/g, '_');
}

function getContent(msg) {
	var content = msg.cleanContent;
	if(msg.attachments.size) {
		if(!content) content = '';
		var cnt = 1;
		msg.attachments.forEach(att => content += ' [Attachment #' + (cnt++) + ': ' + att.url.replace(url.parse(att.url).search, '') + ']');
	}
	if(msg.reference)
		content = '(Reply)' + content;
	return content;
}

client.once('ready', async () => {
	for(var wh in config.webhooks)
		webhooks[wh] = await client.fetchWebhook(config.webhooks[wh][0], config.webhooks[wh][1]);
	client.users.forEach(user => {
		const nick = filter(user.displayName || user.username);
		users[user.id] = {
			nick, 
			username: 'discord_' + user.id, 
			realname: null,
			hostname: 'discord.com', 
			channels: [], 
			fake: true,
			send() {},
			channelNick(channel) { return (this.isOp(channel) ? '@' : '') + this.nick; },
			mask: ':' + nick + '!discord_' + user.id + '@discord.com',
			channelModes: {},
			op(channel) { if(!this.channelModes[channel]) this.channelModes[channel] = ''; this.channelModes[channel] += 'o'; },
			deOp(channel) { if(!this.channelModes[channel]) this.channelModes[channel] = ''; this.channelModes[channel] = this.channelModes[channel].replace(/o/g, ''); },
			isOp(channel) { return this.channelModes[channel] && this.channelModes[channel].match(/o/); },
		};
	});
	for(var ch in config.map) {
		const channel = irc.channels.create(config.map[ch], client.channels.get(ch).topic);
		client.channels.get(ch).members.forEach(member => {
			if(client.channels.get(ch).guild.owner.user.id == member.user.id)
				users[member.user.id].op(channel);
			else
				users[member.user.id].deOp(channel);
			if(channel.memberCount < 40)
				irc.channels.addFakeUser(users[member.user.id], config.map[ch]);
		});
	}
});

client.on(Discord.ThreadManager ? 'messageCreate' : 'message', msg => {
	const channel = irc.channels.find(config.map[msg.channel.id]);
	if(!channel) return;
	const user = users[msg.author.id];
	if(!user) return;
	irc.channels.message(user, channel, getContent(msg));
});

function onIRCMessage(user, ircch, msg) {
	var channel;
	for(var item in config.map)
		if(config.map[item] == ircch.name) {
			channel = client.channels.get(item);
			break;
		}
	if(!channel) return;
	const webhook = webhooks[channel.id];
	if(!webhook) return;
	webhook.send(msg, {
		username: config.prefix + user.nick,
		avatarURL: 'https://secure.gravatar.com/avatar/' + md5(user.mask) + '?d=' + (config.avatarType || 'monsterid'),
	});
}

function onIRCChannelJoin(user, ircch) {
	if(user.fake) return;
	if(!config.restorePreviousMessages) return;
	var channel;
	for(var item in config.map)
		if(config.map[item] == ircch.name) {
			channel = client.channels.get(item);
			break;
		}
	if(!channel) return;
	
	var timeout = 1;
	var it = timeout;
	var cnt = 1;
	
	if(config.restorePreviousMessages)
		channel.fetchMessages().then(_messages => {
			const messages = [];
			_messages.forEach(msg1 => messages.unshift(msg1));
			messages.forEach(msg => {
				var content = getContent(msg);
				
				const iuser = users[msg.author.id];
				if(!iuser) {
					if(msg.author.username.startsWith(config.prefix))
						setTimeout(() => user.send(':' + filter(msg.author.username.replace(config.prefix, '')) + (config.preventAutoIgnore ? ('_' + (cnt++)) : '') + '!' + md5(msg.author.username).slice(0, 16) + (config.preventAutoIgnore ? ('_' + (cnt++)) : '') + '@discord.com', 'PRIVMSG', ircch.name, ':' + content), timeout);
					else
						return;
				} else {
					var mask = iuser.mask;
					if(config.preventAutoIgnore)
						mask = mask.replace('@discord.com', '_' + (cnt++) + '@discord.com').replace('!discord', '_' + (cnt++) + '!discord');
					setTimeout(() => user.send(mask, 'PRIVMSG', ircch.name, ':' + content), timeout);
				}
				timeout += it;
			});
		}).catch(e => {});
}

client.login(config.token);
