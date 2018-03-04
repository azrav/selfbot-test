const Discord = require("discord.js");
const bot = new Discord.Client({autoReconnect: true, max_message_cache: 0});

const path = require("path");
const fs = require("fs");
const ytdl = require("ytdl-core");
const request = require("request");

var serverName = "Whisked Away";
var textChannelName = "music-room";
var voiceChannelName = "radio";

//Associative array w/ guild ID keys
let servers = {}



let cmdCat = [];
cmdCat['GENERAL'] = ['help', 'prefix', 'invite', 'info', 'serverinfo', 'ping'];
cmdCat['UTILS'] = ['setalias', 'deletealias', 'aliases'];

cmdCat['MUSIC'] =['play', 'pause', 'resume', 'stop'
				, 'connect', 'disconnect'
				, 'skip', 'previous', 'skipto'
				, 'playlist', 'clearlist', 'np', 'setnp'];
cmdCat['OWNER'] = ['resetserverconfig'];
cmdCat['DEVELOPER'] = ['setusername', 'setavatar'];

//Music defines
const id_ytplist = 1;
const id_yturl = 2;
const id_sc = 3;

// //Init file needed directories for save&load
// let temp_dir = path.join(process.cwd(), cfg.savePath);
// if (!fs.existsSync(temp_dir))
//     fs.mkdirSync(temp_dir);

//Init default bot config
let cfg = JSON.parse(fs.readFileSync('./settings.json', 'utf-8'));

cfg.token = process.env.BOT_TOKEN;
cfg.yt_api_key = process.env.YT_API_KEY;
cfg.devID = process.env.DEV_ID;

bot.on("ready", ()=>{
	bot.user.setGame(cfg.prefix + cfg.readyAct);
	bot.user.setStatus("stream");
	// bot.user.setActivity({game: {name: cfg.prefix + cfg.readyAct, type: 0}});
});

bot.login(cfg.token);

// fs.access(aliases_file_path, fs.F_OK, (err) => {
// 	if(err)
// 		aliases = {};
// 	else {
// 		try {
// 			aliases = JSON.parse(fs.readFileSync(aliases_file_path));
// 		} catch(err) {
// 			aliases = {};
// 		}
// 	}
// });

// bot.user.setGame();
console.log("Connected!");

bot.on("disconnect", event=>{
	bot.user.setGame(cfg.disconnectAct);
	bot.user.setStatus("offline");

	// bot.user.setActivity({game: {name: cfg.disconnectAct, type: 0}});
	// bot.user.setStatus("offline");
	// console.log("Disconnected: " + event.reason + " (" + event.code + ")");
});

bot.on("message", (msg)=>{
	init_server(msg);

	//Check if message is from permitted channel or
	//if its from bot itself (prevent recursion)
	if (!channel_permit(msg, msg.channel.id, true)
	||	msg.author.id == bot.user.id)
		return;

	//Server prefix
	let prefix = servers[msg.guild.id].cfg.prefix;
	// console.log('server', servers[msg.guild.id]);

	//Message received by DM
	if(msg.channel.type === "dm" && msg.author.id !== bot.user.id)
		msg.channel.send(cfg.dmReply);

	//Text channel
	//Message received on desired text channel
	else if(msg.channel.type === "text") {
		
		//Bot mentioned
		if(msg.isMentioned(bot.user))
			msg.reply(cfg.mentionReply);
		else {
			let tMsg = msg.content;
			
			//Command
			if(tMsg.startsWith(prefix)) {
				console.log('ENTER');
				try {
					handle_cmd(msg, tMsg.substring(prefix.length));
				}
				catch (err) {
					msg.channel.send("`ERROR`\n"+err);
				}
			}
			
			//Speech
			// else
				//handle_respond(msg, tMsg.substring(1));
		}
	}
});

function special_role(msg) {
	roles = '';
	if (msg.member.permissions.has("ADMINISTRATOR"))
		roles += ',MOD';
	if (msg.author.id == msg.guild.ownerID)
		roles += ',OWNER';
	if (msg.author.id == cfg.devID)
		roles += ',DEVELOPER';

	//Remove comma
	if (roles != '')	roles = roles.substring(1);
	return roles;
}

let commands = [

	////////////////////////////////////////
	//General

	{
		command: 'help',
		description: "*h* Displays this message, duh!",
		parameters: [],
		execute: function(msg, params) {
			let adminCategory = false;
			let response = "";

			let roles = special_role(msg);

			for (let cat in cmdCat) {
				//Skip special role categories unsuited for user
				if ((cat == 'OWNER' || cat == 'DEVELOPER' || cat == 'MOD')
				&&	roles.indexOf(cat) == -1)
					continue;

				response += '\n\n__**' + cat + '**__';
				for (let i = 0; i < cmdCat[cat].length; ++i)
				{
					let c = search_cmd(cmdCat[cat][i]);
					if (!c) {
						msg.reply('`ERROR`\n' + c.command + ' does not exist.');
						continue;
					}
					response += "\n!" + c.command;
					for(var j = 0; j < c.parameters.length; j++)
						response += " <" + c.parameters[j] + ">";
					response += ": " + c.description;
				}
			}			
			let embedhelpmember = new Discord.RichEmbed()
			.setTitle("**Help Commands**\n")
			.setDescription(response)
			.setColor(0x1E90FF)
			.setAuthor(msg.author.username)
			.setFooter(roles);
			// .setFooter("You need help, do you?") // sets the footer to "You need help, do you?"

			msg.channel.send(embedhelpmember);
		}
	},

	{
		command: 'invite',
		description: "Invite me to your server~",
		parameters: [],
		execute: function(msg, params) {
			let svr = servers[msg.guild.id];
			msg.channel.send('https://discordapp.com/oauth2/authorize?client_id=415970062999093248&scope=bot&permissions=34630720');
		}
	},

	{
		command: 'info',
		description: "Displays bot info",
		parameters: [],
		execute: function (msg, params) {
			let bicon = bot.user.displayAvatarURL;
			let embed = new Discord.RichEmbed()
			.setDescription('Bot Info')
			.setColor(':')
			.setThumbnail(bicon)
			.addField('Bot Name', bot.user.username)
			.addField('Created on', bot.user.createdAt)
			.addField('Servers running on', bot.guilds.length);

			msg.channel.send(embed);
		}
	},

	{
		command: 'serverinfo',
		description: "Displays server info",
		parameters: [],
		execute: function (msg, params) {
			let sicon = msg.guild.iconURL;
			let embed = new Discord.RichEmbed()
			.setDescription('Server Info')
			.setColor(':')
			.setThumbnail(sicon)
			.addField('Server Name', msg.guild.name)
			.addField('Created On', msg.guild.createdAt)
			.addField('You Joined', msg.member.joinedAt)
			.addField('Total Members', msg.guild.memberCount);

			msg.channel.send(embed);
		}
	},

	{
		command: 'prefix',
		description: "Set a custom prefix.",
		parameters: ["prefix like ~ __default e!__"],
		execute: function(msg, params) {
			let svr = servers[msg.guild.id];

			let prefix = params[1].toLowerCase();
			if (prefix == '') {
				msg.reply("Current prefix is "+ svr.cfg.prefix);
			} else {
				svr.cfg.prefix = prefix;
				fs.writeFileSync(cfg.savePath + msg.guild.id, JSON.stringify(svr.cfg));
				
				msg.reply("Prefix " + prefix + " set successfully.");
			}
			
		}
	},

	{
		command: 'ping',
		description: "I'll ping you back if I'm around~",
		parameters: [],
		execute: function (msg, params) {
			msg.channel.send(':ping_pong: pong~');
		}
	},

	{
		command: 'setalias',
		description: "Sets an alias, overriding the previous one if it already exists",
		parameters: ["alias", "video URL or ID"],
		execute: function(msg, params) {
			let svr = servers[msg.guild.id];

			var alias = params[1].toLowerCase();
			var val = params[2];
			
			svr.cfg.aliases[alias] = val;
			fs.writeFileSync(cfg.savePath + msg.guild.id, JSON.stringify(svr.cfg));
			
			msg.reply("Alias " + alias + " -> " + val + " set successfully.");
		}
	},
	
	{
		command: 'deletealias',
		description: "Deletes an existing alias",
		parameters: ["alias"],
		execute: function(msg, params) {
			let svr = servers[msg.guild.id];
			var alias = params[1].toLowerCase();

			if(!svr.cfg.aliases.hasOwnProperty(alias)) {
				msg.reply("Alias " + alias + " does not exist");
			} else {
				delete svr.cfg.aliases[alias];
				fs.writeFileSync(cfg.savePath + msg.guild.id, JSON.stringify(svr.cfg));
				msg.reply("Alias \"" + alias + "\" deleted successfully.");
			}
		}
	},

	{
		command: 'aliases',
		description: "Displays the stored aliases",
		parameters: [],
		execute: function(msg, params) {
			let svr = servers[msg.guild.id];

			var response = "Current aliases:";
			
			for(var alias in svr.cfg.aliases) {
				if(svr.cfg.aliases.hasOwnProperty(alias)) {
					response += "\n" + alias + " -> " + svr.cfg.aliases[alias];
				}
			}
			
			msg.reply(response);
		}
	},

	{
		command: 'resetserverconfig',
		description: "Reset bot settings for host's server.",
		parameters: [],
		execute: function (msg, params) {

			if (special_role(msg).indexOf('OWNER') == -1)
				return;

			init_server(true);
		}
	},

	////////////////////////////////////////
	//Music
	
	//Playback
	{
		command: 'play'
	,	description: '**pl** Adds & play song request'
	,	parameters: ['video URL, video ID, playlist URL or alias']
	,	execute: (msg, params)=>{
			let svr = servers[msg.guild.id];

			//Not using the 
			if (!msg.member.voiceChannel) {
				msg.reply('use *the right* voice channel.. **Now**');
				return;
			}
			//Not using voice channel
			else if (!msg.guild.voiceConnection) {
				msg.channel.send('*Loading request...*');

				mp_connectVC(msg, ()=>{
					svr.mpStopped = false;
					mp_play(msg, params);
				});
			}
			else if (msg.guild.voiceConnection) {

				// msg.guild.voiceConnection.voiceChannel.id
				// bot.user.voiceChannel

				//Disconnect if not in the right voice channel
				// if (!channel_permit(msg, bot.user.voiceConnections[].get('id'), false)) {
				// 	search_cmd('disconnect').execute(msg, params);
				// 	return;
				// }

				if (!svr.vcConnecting) {
					mp_play(msg, params);
				}
			}
		}
	},

	{
		command: 'pause',
		description: "**p** Pause music playback",
		parameters: [],
		execute: function(msg, params) {
			let svr = servers[msg.guild.id];

			if (svr.dispatcher && !svr.mpStopped) {
				svr.dispatcher.pause();
				msg.reply('-=Music Paused=-');
			} else {
				msg.reply('You are not playing anything at the moment');
			}
		}
	},

	{
		command: 'resume',
		description: "**r** Resume or rebegin music playback",
		parameters: [],
		execute: function(msg, params) {
			let svr = servers[msg.guild.id];

			if (svr.dispatcher && !svr.mpStopped) {
				if (svr.dispatcher.paused) {
					svr.dispatcher.resume();
					msg.reply('-=Music Resume=-');
				} else {
					msg.reply('*its playing already..*');
				}
			} else {
				if (!mp_empty(msg))
				{
					if (mp_inRange(msg))	--svr.mpIndex;
					mp_playNext(msg);
				}
			}
		}
	},

	{
		command: 'stop',
		description: "**st** Stops playlist (will also skip current song!)",
		parameters: [],
		execute: function(msg, params) {
			let svr = servers[msg.guild.id];

			if(svr.mpStopped) {
				msg.reply("Playback is already stopped!");
			} else {
				msg.reply("Stopping!");

				svr.mpStopped = true;
				svr.mpIndex = -1;
				if(svr.dispatcher !== null) {
					svr.dispatcher.end();
					svr.dispatcher = null;
				}
			}

			//Disconnect
			if (msg.guild.voiceConnection)
				msg.guild.voiceConnection.disconnect();
		}
	},

	//Voice Connection
	{
		command: 'connect',
		description: "**con** Stop and disconnect bot from voice channel",
		parameters: [],
		execute: function(msg, params) {
			mp_connectVC(msg);
		}
	},

	{
		command: 'getvolume',
		description: "Display volume of playback",
		parameters: [],
		execute: function(msg, params) {
			msg.reply( 'Volume is at ' + servers[msg.guild.id].cfg.mpVolume + '%' );
		}
	},

	{
		command: 'setvolume',
		description: "Set volume of playback",
		parameters: ['0 to 100'],
		execute: function(msg, params) {
			let svr = servers[msg.guild.id];

			try {
				let vol = parseFloat(params[1]);
				if (vol > cfg.audioMaxVol)
					vol = cfg.audioMaxVol;
				if (vol < 0)	vol = 0;
				servers[msg.guild.id].cfg.mpVolume = vol;
			}
			catch(err) {
				msg.reply('`Error`\n'+err);
				return;
			}		
			fs.writeFileSync(cfg.savePath + msg.guild.id, JSON.stringify(svr.cfg));

			msg.reply( 'Volume set to ' + servers[msg.guild.id].cfg.mpVolume + '%' );
			mp_setVolume(msg);
		}
	},

	//Navigate
	{
		command: 'skip',
		description: "**next** Skips the current song",
		parameters: [],
		execute: function(msg, params) {
			let svr = servers[msg.guild.id];

			if(svr.dispatcher !== null) {
				msg.reply("Skipping...");
				svr.dispatcher.end();
			} else {
				msg.reply("There is nothing being played.");
			}
		}
	},

	{
		command: 'previous',
		description: "**prev** Previous song in playlist",
		parameters: [],
		execute: function(msg, params) {
			let svr = servers[msg.guild.id];
			let index = svr.mpIndex-1;

			if (mp_inRange(msg, index)) {
				msg.reply("Skipping to "+index);
				svr.mpIndex = index-1;
				svr.dispatcher.end();
			}
			else	msg.reply('Index out of range');
		}
	},

	{
		command: 'skipto',
		description: "**jumpto** Skips to song on playlist index",
		parameters: ['Song index'],
		execute: function(msg, params) {
			let svr = servers[msg.guild.id];
			let index = params[1];

			if (mp_inRange(msg, index)) {
				msg.reply("Skipping to "+index);
				svr.mpIndex = index-1;
				svr.dispatcher.end();
			}
			else	msg.reply('Index out of range');
		}
	},

	//List Management
	{
		command: 'playlist',
		description: "**queue, list** List playlist~",
		parameters: [],
		execute: function(msg, params) {
			let response = "";
			let svr = servers[msg.guild.id];
	
			if(mp_empty(msg)) {
				response = "the queue is empty.";
			} else {
				var long_queue = svr.mpList.length > 30;
				for(var i = 0; i < (long_queue ? 30 : svr.mpList.length); i++) {
					response += "\"" + svr.mpList[i]["title"] + "\" *" + svr.mpList[i]["user"] + "*\n";
				}

				if(long_queue) response += "\n**...and " + (svr.mpList.length - 30) + " more.**";
			}
			
			msg.reply(response);
		}
	},

	{
		command: "clearlist",
		description: "**cq, clearqueue, cl** Clear playlist",
		parameters: [],
		execute: function(msg, params) {
			let svr = servers[msg.guild.id];
			svr.mpList = [];
			svr.mpIndex = -1;
			svr.mpLastInList = 0;
			msg.reply("Queue has been cleared!");
		}
	},

	//Info
	{
		command: "np",
		description: "Displays the current song",
		parameters: [],
		execute: function(msg, params) {
			let svr = servers[msg.guild.id];

			let response = "Now playing: ";
			if(mp_playing(msg))
				response += "\"" + svr.mpNowPlaying["title"] + "\" (requested by " + svr.mpNowPlaying["user"] + ")";
			else
				response += "nothing!";

			msg.reply(response);
		}
	},

	{
		command: "setnp",
		description: "Sets whether the bot will announce the current song or not",
		parameters: ["on/off"],
		execute: function(msg, params) {
			let svr = servers[msg.guild.id];

			if(params[1].toLowerCase() == "on") {
				var response = "Will announce song names in chat";
				svr.mpInformNP = true;
			} else if(params[1].toLowerCase() == "off") {
				var response = "Will no longer announce song names in chat";
				svr.mpInformNP = false;
			} else {
				var response = "Sorry?";
			}
			
			msg.reply(response);
		}
	},

	////////////////////////////////////////
	//Dev

	{
    	command: "setusername",
		description: "Set username of bot",
		parameters: ["Username or alias"],
		execute: function (msg, params) {
			if (special_role(msg).indexOf('DEVELOPER') == -1)
				return;

			let svr = servers[msg.guild.id];
			var userName = params[1];
			if (svr.cfg.aliases.hasOwnProperty(userName.toLowerCase())) {
				userName = svr.cfg.aliases[userName.toLowerCase()];
			}

			bot.user.setUsername(userName).then(user => {
				msg.reply('✔ Username set!');
			})
			.catch((err) => {
				msg.reply('Error: Unable to set username');
			});
		}
	},
  
	{
		command: "setavatar",
		description: "Set bot avatar, overriding the previous one if it already exists",
		parameters: ["Image URL or alias"],
		execute: function (msg, params) {
			if (special_role(msg).indexOf('DEVELOPER') == -1)
				return;

			let svr = servers[msg.guild.id];
			var url = params[1];
			if (svr.cfg.aliases.hasOwnProperty(url.toLowerCase())) {
				url = svr.cfg.aliases[url.toLowerCase()];
			}

			bot.user.setAvatar(url).then(user => {
				msg.reply('✔ Avatar set!');
			})
			.catch((err) => {
				msg.reply('Error: Unable to set avatar');
				console.log('Error on setavatar command:', err); 
			});
		}
	},

	{
		command: "eval",
		description: "shh~ Dev Debug Command",
		parameters: [],
		execute: function (msg, params) {
			if (special_role(msg).indexOf('DEVELOPER') == -1)
				return;
			try {
				let code = params.join(' ');
				console.log('code: ', code);
				let evaled = eval(code);

				if (typeof evaled !== 'string') {
					// console.log('util: ', util.inspect(evaled));	
					evaled = require('util').inspect(evaled);
				}

				msg.channel.sendCode('xl', clean(evaled));
			} catch (err) {
				msg.channel.sendMessage(`\`ERROR\` \`\`\`xl\n${clean(err)}\n\`\`\``);
			}
		}
	},

	{
		command: 'logout',
		description: "Leaves connection and goes offline.",
		parameters: [],
		execute: function (msg, params) {
			if (special_role(msg).indexOf('DEVELOPER') == -1)
				return;

			bot.destroy();
		}
	}
];

// function playlist_manager(msg) {
// 	//
// }

////////////////////////////////////////
//	Overseer helpers
////////////////////////////////////////

function init_server(msg, reset=false) {

	//Server reset
	if (reset && servers[msg.guild.id])
		[msg.guild.id] = null;

	//If server config non-existent, create new default
	if (!servers[msg.guild.id]) {
		// let defPf = cfg.prefix;
		// console.log('defPf', defPf);

		servers[msg.guild.id] = {
			cfg: {
				prefix: 'e!'		//custom prefix
			,	tc: ''				//textChannel permit
			,	vc: ''				//voiceChannel permit
			,	aliases: []			//aliases
			,	mpLoop: false		//Loop playlist
			,	mpShuffle: false	//Shuffle playlist
			,	mpRepeat: false		//Song on repeat
			,	mpInformNP: false	//Notify next playing
			,	mpVolume: 100		//Volume
			}

		//Channels
		,	voiceConnection: null
		,	dispatcher: null
		,	textChannel: null
		,	vcConnecting: false

		//Music vars
		,	mpNowPlaying: {}	//Now playing data
		,	mpStopped: true		//Playback stopped
		,	mpIndex: []			//Playlist (similar to queue)
		,	mpList: []			//Playlist (similar to queue)
		,	mpOrder: []			//Song order cache
		,	mpStream: null		//Audio stream
		,	mpLastInList: 0		//Last index in list
		}
	}

	load_db(msg);
}

function load_db(msg) {
	let svr = servers[msg.guild.id];
	// console.log('svr', svr);

	fs.access(cfg.savePath + msg.guild.id, fs.F_OK, (err) => {
		if(err) {
			// console.log('svr2', svr);
			svr.cfg.aliases = {};
		} else {
			try {
				svr.cfg = JSON.parse(fs.readFileSync(cfg.savePath + msg.guild.id));
			} catch(err) {
				svr.cfg.aliases = {};
			}
		}
	});
}

function channel_permit(msg, id, textNotVoice) {
	let svr = servers[msg.guild.id];
	let server = bot.guilds.get("id", msg.guild.id);

	let chName = textNotVoice ? svr.cfg.tc : svr.cfg.vc;
	let chType = textNotVoice ? 'text' : 'voice';

	if (chName == '')	return true;

	//The voice channel the bot will connect to
	let channel = server.channels.find(chn => chn.name === chName && chn.type === chType);
	if(channel === null) {
		console.log(chType + ' channel "' + chName + '" not permitted');
		return false;
	}
	if (id == channel.id)	return false;
	return true;
	// throw "Couldn't find permitted voice channel '" + scfg.tc.vc + "' in this server '" + server_name + "'";
}

function search_cmd(command_name) {
	for(var i = 0; i < commands.length; i++) {
		if(commands[i].command == command_name.toLowerCase()) {
			return commands[i];
		}
	}

	return false;
}


function exec_cmd(key, msg, params) {
	let cmd = search_cmd(key);
	if (cmd) {
		if(params.length - 1 < cmd.parameters.length)
			msg.reply("Insufficient parameters!");
		else
			cmd.execute(msg, params);
	}
	else {
		console.log('key: ', key);
		msg.channel.send('Invalid Command');
	}
}


function handle_cmd(msg, text) {
	var params = text.split(" ");
	let cmd = null;

	let key = params[0].toLowerCase();

	switch (params[0].toLowerCase())
	{
		//Mod
		case 'h':		key = 'help';	break;
		
		////////////////////////////////////////
		//Music

		//Playback
		case 'pl':		key = 'play';	break;
		case 'p':		key = 'pause';	break;
		case 'r':		key = 'resume';	break;
		case 'st':		key = 'stop';	break;

		//Voice
		case 'con':		key = 'connect';	break;
		case 'dc':		key = 'disconnect';	break;
		
		//Navigate
		case 'next':	key = 'skip';		break;
		case 'prev':	key = 'previous';	break;
		case 'jumpto':	key = 'skipto';		break;

		//Playlist
		case 'songlist':case 'queue':case 'list':
			key = 'playlist';
			break;

		case 'cq':case 'clearqueue':case 'cl':
			key = 'clearlist';
			break;
	}
	exec_cmd(key, msg, params);
}



////////////////////////////////////////
//	Music Player helpers
////////////////////////////////////////

function mp_setVolume(msg) {
	let svr = servers[msg.guild.id];
	let vol = svr.cfg.mpVolume/100;
	if (svr.dispatcher)
		svr.dispatcher.setVolume(vol);
}

function mp_idType(str) {
	if (str.indexOf('youtube.com/playlist?list=') != -1)	return id_ytplist;
	else if (str.indexOf('youtube.com/watch?v=') != -1)		return id_yturl;
	else if (str.indexOf('soundcloud.com') != -1)			return id_sc;
	return 0;
}

function mp_play(msg, params) {
	let svr = servers[msg.guild.id];

	if (!mp_empty(msg)) {
		svr.mpLastInList = svr.mpList.length;
	}

	if(svr.cfg.aliases.hasOwnProperty(params[1].toLowerCase())) {
		params[1] = svr.cfg.aliases[params[1].toLowerCase()];
	}

	//Youtube URL ID fetching
	let regExp = /^.*(youtu.be\/|list=)([^#\&\?]*).*/;
	let match = params[1].match(regExp);

	switch (mp_idType(params[1]))
	{
		case id_ytplist:
			console.log('yt-playlist');
			if (match && match[2])
				mp_playlist(match[2], msg);
			return;

		case id_yturl:
			console.log('yt-url');
			let id = get_video_id(params[1]);
			svr.mpOrder[id] = 0;
			svr.mpList.push(null);
			mp_append(id, msg, false, params);
			break;

		case id_sc:
			console.log('sc');
			
			break;

		default:
		{
			//Search
			console.log('searching');
			if(cfg.yt_api_key === null) {
				msg.reply("You need a YouTube API key in order to use the !search command. Please see https://github.com/agubelu/discord-music-bot#obtaining-a-youtube-api-key");
			} else if (params) {
				var q = "";
				for(var i = 1; i < params.length; i++)
					q += params[i] + " ";
				mp_searchVid(msg, q);
			}
		}
	}
}

function mp_inRange(msg, index = -10) {
	let svr = servers[msg.guild.id];

	//Empty playlist: out of range
	if (mp_empty(msg))	return false;

	//If default index
	if(index == -10)	index = svr.mpIndex;

	if (index >= 0 && index < (svr.mpList.length-1))
		return true;
	return false;
}

function mp_append(video, msg, mute = false, params = null) {
	let svr = servers[msg.guild.id];
	if(svr.cfg.aliases.hasOwnProperty(video.toLowerCase())) {
		video = svr.cfg.aliases[video.toLowerCase()];
	}

	var video_id = get_video_id(video);
	console.log('video_id: '+video_id);

	ytdl.getInfo("https://www.youtube.com/watch?v=" + video_id, (error, info) => {
		if(error) {
			msg.reply("The requested video (" + video_id + ") does not exist or cannot be played.");
			console.log("Error (" + video_id + "): " + error);
			checkListLoadEnd(video_id, msg);

		} else {
			console.log('push: ' + info["title"] +  ', ' + video_id);
			console.log('svr.mpOrder', svr.mpOrder);

			console.log('svr.mpOrder[video_id]', svr.mpOrder[video_id]);
			console.log('svr.mpLastInList', svr.mpLastInList);

			svr.mpList[ svr.mpLastInList + svr.mpOrder[video_id] ] = {title: info["title"], id: video_id, user: msg.author.username};
			console.log('mpList', svr.mpList);
			console.log('mpIndex', svr.mpIndex);

			checkListLoadEnd(video_id, msg);

			if (!mute) {
				msg.reply('"' + info["title"] + '" has been added to the queue.');
			}

			if(!svr.mpStopped && !mp_playing(msg) && mp_empty(msg)) {
				mp_playNext(msg);
				console.log('pns');
			}
		}
	});
}

function checkListLoadEnd(video_id, msg)
{
	let svr = servers[msg.guild.id];

	delete svr.mpOrder[video_id];
	if (Object.keys(svr.mpOrder).length == 0
	&&	svr.mpList.length > 0) 
	{
		svr.mpOrder = [];

		//Remove unsuccessfully fetched songs
		// console.log('svr.mpList', svr.mpList);
		for (let i = 0; i < svr.mpList.length; ++i)
			if (!svr.mpList[i])	svr.mpList.splice(i,1);

		// mpIndex = (mpList.length > 0) ? -1 : 0;

		if(svr.mpIndex == -1) {
			//Index -1 if list not empty
			svr.mpStopped = false;
			svr.mpIndex = -1;
			mp_playNext(msg);
			console.log('pns');
		}
	}
}

function mp_playNext(msg)
{
	let svr = servers[msg.guild.id];

	if (svr.voiceConnection && svr.voiceConnection.playing)
		return;

	if(mp_empty(msg))
		msg.channel.send("The queue is empty!");

	//If not repeating the same song
	if (!svr.cfg.mpRepeat)
	{
		console.log('mpIndex', svr.mpIndex);
		console.log('mpList', svr.mpList.length);

		//Next index if possible
		if ((svr.mpIndex + 1) < svr.mpList.length)	++svr.mpIndex;

		//End of list, loop list if permitted
		else if (svr.cfg.mpLoop)	svr.mpIndex = 0;

		//Announce end & await for instruction
		else {
			console.log('mpList.length', svr.mpList.length);
			console.log('mpIndex', svr.mpIndex);
			msg.channel.send('End of playlist');
			svr.mpStopped = true;
			svr.mpIndex = -1;
			console.log('lol why');
			return;
		}
	}

	if (!svr.mpList[svr.mpIndex]){
		console.log('mpList['+svr.mpIndex+'] is null');
		return;
	}

	let video_id = svr.mpList[svr.mpIndex]["id"];
	let title = svr.mpList[svr.mpIndex]["title"];
	let user = svr.mpList[svr.mpIndex]["user"];

	svr.mpNowPlaying["title"] = title;
	svr.mpNowPlaying["user"] = user;

	if(svr.mpInformNP) {
		msg.channel.send('Now playing: "' + title + '" &' + user + '*');
		bot.user.setGame(title);
	}

	// svr.mpStream = ytdl("https://www.youtube.com/watch?v=" + video_id, {filter: 'audioonly'});
	svr.mpStream = ytdl("https://www.youtube.com/watch?v=" + video_id);
	console.log('AUDIO:'+ video_id +'!');

	mp_playstream(msg);
}

function mp_playstream(msg) {
	let svr = servers[msg.guild.id];

	if (svr.vcConnecting)
		return;

	console.log('PLAYSTREAM!');
	svr.dispatcher = svr.voiceConnection.playStream(svr.mpStream);

	svr.dispatcher.once("end", reason => {
		svr.dispatcher = null;
		bot.user.setGame();
		console.log('svr.mpStopped: ', svr.mpStopped);
		console.log('mp_empty(msg): ', mp_empty(msg));
		if(!svr.mpStopped && !mp_empty(msg) && !svr.vcConnecting) {
			mp_playNext(msg);
		}
	});
}

function mp_empty(msg) {
	return servers[msg.guild.id].mpList.length === 0;
}

// function mp_stopped(msg) {
// 	let svr = servers[msg.guild.id];
// 	if (!mpStopped && svr.voiceConnection && svr.voiceConnection.playing) {
// 		return false;
// 	}
// 	return true;
// }

function mp_playing(msg) {
	let svr = servers[msg.guild.id];
	return (svr.dispatcher !== null);
}

function mp_connectVC(msg, callback=null) {
	let svr = servers[msg.guild.id];
	// let server = bot.guilds.get("id", msg.guild.id);
	// let channel = server.channels.find(chn => chn.id == msg.member.voiceSessionID);
	let channel = msg.member.voiceChannel;
	msg.reply('Attempt 2 connect 2: '+ msg.member.voiceChannel);
	svr.vcConnecting = true;

	if (!channel) {
		msg.reply('Cannot find Channel');
		return;
	}

	console.log('connectVC:');
	// const channel = msg.member.voiceChannel;
	msg.reply('Attempting to connect to '+channel.id);
		
	channel.join().then(connection => {
		console.log('CONNECT!');
		svr.voiceConnection = connection;
		mp_setVolume(msg);
		svr.vcConnecting = false;
		if (callback)	callback();
	}).catch(console.error);
}

function mp_searchVid(msg, query, index=0) {
	console.log('start: ', query, index);
	let svr = servers[msg.guild.id];

	request("https://www.googleapis.com/youtube/v3/search?part=id&type=video&q=" + encodeURIComponent(query) + "&key=" + cfg.yt_api_key, (error, response, body) => {
		var json = JSON.parse(body);
		if("error" in json) {
			msg.reply("An error has occurred: " + json.error.errors[0].msg + " - " + json.error.errors[0].reason);
		} else if(json.items.length === 0) {
			msg.reply("No videos found matching the search criteria.");
		} else {
			svr.mpOrder[json.items[0].id.videoId] = index;	//append to order map
			svr.mpList.push(null);
			mp_append(json.items[0].id.videoId, msg);		//append vid
		}
	})
}

function mp_playlist(playlistId, msg, pageToken = '') {
	let svr = servers[msg.guild.id];

	request("https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=" + playlistId + "&key=" + cfg.yt_api_key + "&pageToken=" + pageToken, (error, response, body) => {
		var json = JSON.parse(body);
		if ("error" in json) {
			msg.reply("An error has occurred: " + json.error.errors[0].msg + " - " + json.error.errors[0].reason);
		} else if (json.items.length === 0) {
			msg.reply("No videos found within playlist.");
		} else {
			for (var i = 0; i < json.items.length; i++)
				servers[msg.guild.id].mpList.push(null);

			for (var i = 0; i < json.items.length; i++) {
				console.log('No ' + i + ": " + json.items[i].snippet.resourceId.videoId);
				svr.mpOrder[json.items[i].snippet.resourceId.videoId] = i;
				mp_append(json.items[i].snippet.resourceId.videoId, msg, true)
			}
			if (json.nextPageToken == null){
				return;
			}
			mp_playlist(playlistId, msg, json.nextPageToken)
		}
	});
}

function get_video_id(string) {
	var regex = /(?:\?v=|&v=|youtu\.be\/)(.*?)(?:\?|&|$)/;
	var matches = string.match(regex);

	if(matches) {
		return matches[1];
	} else {
		return string;
	}
}

function clean(text) {
	if (typeof(text) === 'string')
		return text.replace(/`/g, "`" + String.fromCharCode(8203)).replace(/@/g, "@" + String.fromCharCode(8203));
	else
		return text;
}

//https://cdn.discordapp.com/avatars/415970062999093248/d65f9f6aaf5456703a8d0dc24162d129.jpg?size=2048
//https://lh5.googleusercontent.com/gCcY2EKuTHtcpW0E1mZdrXsmLj6sHsQaYEBYcskTCgJOJ9npE5tKmKpqfuB_0nqda6IY9FeVoXOvozNYo630=w1920-h917
