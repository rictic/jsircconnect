var socketId;
var dataFromRead = "";
var serverConnect = "irc.freenode.net";
var ircPort = 6667;
var serverName;
var channelName ="#optimism";
var timeOfLastChanMsg = new Date();
timeOfLastChanMsg.setTime(1); //initialize the time to 1.
var silentTimeMin=.5;


//OptimistBot Sayings
var goodVibes = ["Great job team!","Wow! I can't believe how much headway we're making!",
"That's a great point! Let's explore this perspective with bit more dicussion. ",
"Keep up the great work team! This discussion is fascinating!",
"This is very encouraging. We are reaching our goals by talking things out.",
"All of these are great ideas! Let's keep going and get everyone's contribution.",
"Congratulations team! Great work so far!",
"Thanks for mentioning that. That's a perspective I've never thought about before.",
"All right! Fantastic point!",
"Just wanted to throw in my two cents- you're all doing a dynamite job here!",
"That's one thing I love about this channel- the truly diverse ideas being discussed. Great job!",
"I like that. Let's brainstorm some more on this idea.",
];

var userName;

function IrcCommand() {
  this.prefix = "";
  this.command = "";
  this.username = "";
  this.args = [];
}

chrome.storage.local.get('userName', function(results)
{
  userName = results.userName || 'OptimistBot';

  chrome.socket.create('tcp', {}, function onSocketCreate(createInfo)
  {
    socketId = createInfo.socketId;
    chrome.socket.connect(socketId, serverConnect, ircPort, onConnected);
  }); // end socket.create
}); // end get userName from storage


function onConnected()
{
  document.getElementById('connectionStatus').textContent = "connected!";
  readForever();
  console.log(socketId);
  read();
  write('PASS none');
  write('NICK ' + userName);
  write('USER USER 0 * :Real Name', function()
  {
    //wait for a sign that we're registered before joining.
    //Welcome to the Internet Relay Network -RPL_WELCOME via IRC RFCs
    //socket.listen is not  an option for client side connections. let's try reading until we get what we want
    var welcomeMsg="";
    var dateRead = new Date();
    console.log(dateRead+": Wrote after USER\r\n");

    //write('JOIN #realtestchannel\r\n');
  })//end write
} // end onConnected

function onDisconnected()
{
  document.getElementById('connectionStatus').textContent = "disconnected :(";
  chrome.socket.disconnect(socketId);
} // end onDisconnected

function write(s, f)
{
  s+="\r\n";
  console.log(s);

  //Make sure we're not spamming the channel. If this is going to the channel, check to see how often we're sending.

  if (s.search("PRIVMSG "+channelName)>-1)
   {
    //should we write this?
    var dateObj = new Date();
    if (dateObj.getTime()-timeOfLastChanMsg.getTime()>silentTimeMin*60000)
    {
      displayLineToScreen("[sent] " + s);
      chrome.socket.write(socketId, str2ab(s), function(good) {console.log('write was ', good); if (f) f();});
      timeOfLastChanMsg.setTime(dateObj.getTime());
    }
    else
    {
      console.log("You don't get to write because you messaged the channel already. dateObj.getTime: ")
      console.log(dateObj.getTime());
      console.log("Time of timeOfLastChanMsg")
      console.log(timeOfLastChanMsg.getTime());
      console.log(dateObj.getTime()-timeOfLastChanMsg.getTime())
      console.log(dateObj.getTime()-timeOfLastChanMsg.getTime()<silentTimeMin*60000)
    }
  }
  else
  {
    displayLineToScreen("[sent] " + s);
    chrome.socket.write(socketId, str2ab(s), function(good) {console.log('write was ', good); if (f) f();});
  }
}//end write

function str2ab(str)
{
  var buf = new ArrayBuffer(str.length*1); // 1 byte for each char
  var bufView = new Uint8Array(buf);
  for (var i=0, strLen=str.length; i<strLen; i++)
  {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

function ab2str(buf)
{
  return String.fromCharCode.apply(null, new Uint8Array(buf));
}

function read()
{
  chrome.socket.read(socketId, null, function(readInfo) {
    if (readInfo.resultCode > 0) {
      var dateRead = new Date();
      console.log(dateRead + ab2str(readInfo.data));
      dataFromRead+=dateRead.getTime()+ab2str(readInfo.data)+"/n";
    }
  });

}//end read

function readForever(readInfo)
{
  if(readInfo!==undefined && readInfo.resultCode <= 0)
  {
    // we've been disconnected, dang.
    onDisconnected();
    return;
  }
  if (readInfo !== undefined)
  {
    var dateRead = new Date();
    var serverMsg = ab2str(readInfo.data);
    console.log(dateRead + serverMsg);
    // warning: this is a space leak. the longer the bot is connected, the
    // bigger this string will be
    dataFromRead+=dateRead.getTime()+serverMsg+"/n";
    //if trigger matches data, do stuff here.

    var serverLines = [];
    var serverMessages = [];
    serverLines = serverMsg.split("\n");

    //Split the server messages into single lines.
    for(var i = 0; i < serverLines.length; i++)
    {
      //If the line wasn't empty, save the message.
      var msg = crackMessage(serverLines[i]);
      if(msg !== undefined)
      {
        serverMessages.push(msg);
      }
    }

    var messageLines = serverMsg.trim().replace(/\r/g, '').split('\n');
    for (var i = 0; i < messageLines.length; i++)
    {
      displayLineToScreen(messageLines[i]);
		}

    //get server name
    if(!serverName)
    {
      serverName = serverMsg.substring(1,serverMsg.search(' '));
    }

    for(var i = 0; i < serverMessages.length; ++i)
    {
      var m = serverMessages[i];
			console.log(m.command, m);
      switch(m.command)
      {
        //Welcome message!
        case "001":
          write('JOIN ' + channelName);
          break;
        case "PING":
					write("PONG :"+serverName);
					displayLineToScreen('[SERVER PONG]');
          break;
        case "PRIVMSG":
          handlePrivmsg(m);
          break;
        default:
					//All this spew is a bit annoying.
          //console.log("WARN: Unhandled message: ", m);
          break;
      }
    }

    //if MSG, respond

    //if channel message =5 and last date spoken is >5 minutes ago, say something
    //if msg !stfu x, be silent for x minutes.
  }

  chrome.socket.read(socketId, null, readForever); //On Peter's advice changing this to just call itself
}//end readForever

function setUserName(newUserName, optionalCallback)
{
  chrome.storage.local.set({userName: newUserName}, optionalCallback);
} // end setUserName

//Converts a single message from an IRC server into an IrcCommand object.
function crackMessage(serverLine) {
  if(serverLine.length == 0)
  {
    return undefined;
  }
  var r = new IrcCommand();
  var parts = serverLine.split(" ");
  var offset = 0;

  //If our message had a prefix, store it.
  if(parts[0][0] == ":" )
  {
    r.prefix = parts[0];
    offset = 1;
  }
  r.command = parts[0+offset];
  r.username = parts[1+offset];
  r.args = parts.slice(2+offset);
  return r;
}

function handlePrivmsg(message) {
	//This is a message to the channel:
	if(message.username === channelName)
	{
		for(var i = 0; i < message.args.length; ++i)
		{
			var arg = message.args[i];
			//Slice off the colon from the first arg.
			//FIXME: We should do this fixup elsewhere.
			if(i === 0)
			{
				arg = arg.substring(1);
			}
			if(arg.search(userName) != -1)
			{
				write("PRIVMSG " + channelName + " :I LIKE RAINBOWS?");
			}
		}
	}
	//If not, it must be a message to me.
	else
	{
		var messagingUser = message.prefix.slice(1, message.prefix.search("!"));
		write("PRIVMSG " + messagingUser + " :I LIKE RAINBOWS!?");
	}
}

function displayLineToScreen(text)
{
  var p = document.createElement('pre');
  p.textContent = text;
  var container = document.getElementById('recent-chat-display');
  container.appendChild(p);
  while (container.childNodes.length > 15)
  {
    container.childNodes[0].remove();
  }
}

var inputElement = document.getElementById('typing');
inputElement.addEventListener('keydown', function (event)
{
  // if the user pushed the enter key while typing a message (13 is enter):
  if (event.keyCode === 13)
  {
    var message = inputElement.value;
    inputElement.value = "";
    write("PRIVMSG " + channelName + " :" + message);
  }
})
