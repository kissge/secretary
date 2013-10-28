var fs = require('fs');
var exec = require('child_process').exec;
var twitter = require('ntwitter');
var config = require('./config.inc');
var twit = new twitter(config.twitterAPIKey);
var record = {};
try { record = require('./record').record; } catch (e) {}


var Secretary =
{
    main: function ()
    {
	Secretary.logWithDateAndTime('<<start>>');

	twit.stream('user',
		    { track: ['@' + config.id]},
		    function(stream) {
			stream.on('data', function (data) {
			    if (data && !data.retweeted_status)
				Secretary.triggeredAction(data);
			});
			stream.on('end', function (response) {
			    Secretary.logWithDateAndTime('<<end>>', response);
			    reboot();
			});
			stream.on('destroy', function (response) {
			    Secretary.logWithDateAndTime('<<destroy>>', response);
			    reboot();
			});
			stream.on('error', function (response) {
			    Secretary.logWithDateAndTime('<<error>>', response);
			    stream.destroy();
			});
		    });
    },

    triggeredAction: function (data)
    {
	if (data.text && data.user && data.user.id_str)
	{
	    Secretary.logWithDateAndTime(data.user.id_str, data.user.screen_name, data.text);
	    var command = data.text.split('@' + config.id + ' ')[1]
	    if (typeof command !== 'string') return;
	    op = command.split(' ')[0];
	    switch (op)
	    {
	    case 'add':
	    case 'push':
	    case 'new':
	    case 'put':
	    case '追加':
		if (!Secretary.isKnownUser(data.user.id_str))
		{
		    Secretary.newUser(data.user.id_str);
		    Secretary.sendReply(data.user.screen_name, '新規タスクリストを作成しました．', data.id_str);
		}
		var c = Secretary.addTask(data.user.id_str, command = command.substr(op.length + 1));
		Secretary.sendReply(data.user.screen_name, '「' + command + '」を追加しました．現在 ' + c + ' 個のタスクがあります．', data.id_str);
		Secretary.saveData();
		break;
	    case 'get':
	    case 'list':
	    case 'enum':
	    case 'check':
	    case '確認':
		if (Secretary.isKnownUser(data.user.id_str))
		{
		    var c = Secretary.getTaskList(data.user.id_str);
		    Secretary.sendReply(data.user.screen_name, c.length + ' 個のタスクがあります：' + c.join('，'), data.id_str);
		}
		else
		    Secretary.sendReply(data.user.screen_name, 'エラー：あなたのタスクリストはまだ作成されていません．', data.id_str);
		break;
	    case 'remove':
	    case 'pop':
	    case 'delete':
	    case 'rm':
	    case '削除':
	    case '完了':
		if (Secretary.isKnownUser(data.user.id_str))
		{
		    var c = Secretary.removeTask(data.user.id_str, command = command.substr(op.length + 1));
		    if (c === false)
			Secretary.sendReply(data.user.screen_name, 'エラー：「' + command + '」は見つかりません．', data.id_str);
		    else
		    {
			Secretary.sendReply(data.user.screen_name, '「' + command + '」を削除しました．現在 ' + c + ' 個のタスクがあります．', data.id_str);
			Secretary.saveData();
		    }
		}
		else
		    Secretary.sendReply(data.user.screen_name, 'エラー：あなたのタスクリストはまだ作成されていません．', data.id_str);
		break;
	    default:
		Secretary.sendReply(data.user.screen_name, 'エラー：「' + op + '」は認識できないコマンドです．', data.id_str);
	    }
	}
	else
	    Secretary.logWithDateAndTime(data);
    },

    newUser: function (id)
    {
	record['user' + id] = [];
    },

    addTask: function (id, task)
    {
	record['user' + id].push(task);
	return record['user' + id].length;
    },

    removeTask: function (id, task)
    {
	var i = record['user' + id].indexOf(task);
	if (i == -1) return false;
	record['user' + id].splice(i, 1);
	return record['user' + id].length;
    },
    
    getTaskList: function (id)
    {
	Secretary.log(record['user' + id]);
	return record['user' + id];
    },

    isKnownUser: function (id)
    {
	return ('user' + id) in record;
    },

    saveData: function ()
    {
	return fs.writeFileSync('./record.js', 'exports.record = ' + JSON.stringify(record));
    },

    sendReply: function (id, content, in_reply_to)
    {
	var limit = 138 - (id + '').length;
	var l = new Array();
	while (content.length > 0)
	{
	    l.push(content.substr(0, limit));
	    content = content.substr(limit);
	}
	for (var i = 0; i < l.length; i++)
	    twit.updateStatus('@' + id + ' ' + l[i],
    	    		      in_reply_to ? { in_reply_to_status_id : in_reply_to } : {},
    	    		      function (err, data)
	    		      {
	    			  if (err) Secretary.logWithDateAndTime("[sendReplyError]", err, data);
	    		      });
    },

    reboot: function ()
    {
	exec('sleep 5 && /usr/local/bin/node secretary.js');
	process.exit(0);
    },

    log: function ()
    {
	console.log(arguments);
    },

    logWithDateAndTime: function ()
    {
	console.log(arguments);
	console.log(new Date().toString());
    }
}

Secretary.main();