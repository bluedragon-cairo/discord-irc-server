IRC server that connects/bridges to a Discord server

It requires Node.js 7.6 or higher, if you are on Windows XP/Vista, then you might want to try out the [Windows XP port of Node.js 8.6](https://github.com/hlizard/node8-xp/raw/v8.6.0-xp/Release/Release.zip)

Depends on https://github.com/bluedragon-cairo/ircd.js-for-comic-chat

It uses Discord.js v11 but it would work with v12 and v13 too.

discord-irc.json example:
```json
{
	"prefix": "[IRC] ",
	"map": {
		"DISCORD CHANNEL ID": "#IRC CHANNEL NAME"
	},
	"webhooks": {
		"DISCORD CHANNEL ID": ["WEBHOOK ID", "WEBHOOK TOKEN"]
	},
	"token": "bot's token",
	"restorePreviousMessages": true,
	"preventAutoIgnore": false,
	"host": "0.0.0.0",
	"port": 6667,
	"motd": "Message of the day",
	"avatarType": "monsterid"
}
```
