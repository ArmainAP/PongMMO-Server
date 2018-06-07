var server = require('http').createServer();
var io = require('socket.io')(server);

var PlayerObject = {
  ID:  "",
  Yaw:  0,
  X:  0,
  Y:  0,
  Count:  0,
  AddBoard: true
};
var Players = {};

var AddPlayer = function(id) {
  PlayerObject.ID = id;
  
  if (io.engine.clientsCount == 1)
    Transform(2, 0);
  else if (BoardObject.Corner && Boards.length > 2) {
    var Direction = (BoardObject.Direction == 0) ? 3 : (BoardObject.Direction - 1);
    Transform(Direction, PlayerObject.Count);
    PlayerObject.Count++;
  }
  else {
    Transform(BoardObject.Direction, PlayerObject.Count);
    PlayerObject.Count++;
  }
  
  switch(PlayerObject.Count) {
    case 2: {
      if(!BoardObject.Corner) {
        PlayerObject.Count = 0;
        PlayerObject.AddBoard = true;
      }
      break;
    }
      
    case 3: {
      PlayerObject.Count = 0;
      PlayerObject.AddBoard = true;
      break;
    }
  }
  
  Players[id] = { ID: PlayerObject.ID, Yaw: PlayerObject.Yaw, X: PlayerObject.X + BoardObject.X * 40, Y: PlayerObject.Y + BoardObject.Y * 40, Origin: {X: PlayerObject.X + BoardObject.X * 40, Y: PlayerObject.Y + BoardObject.Y * 40} };
};

var RotationTable = [ [ 1, 2, 3 ], [ 3, 1, 0 ], [ 0, 3, 2 ], [ 2, 0, 1 ] ];
var Transform = function(SwitchDirection, Count) {
  switch (RotationTable[SwitchDirection][Count]) {
    case 0: {
      PlayerObject.Yaw = 0;
      PlayerObject.X = -20;
      PlayerObject.Y = 0;
      break;
    }
      
    case 1: {
      PlayerObject.Yaw = 180;
      PlayerObject.X = 20;
      PlayerObject.Y = 0;
      break;
    }
      
    case 2: {
      PlayerObject.Yaw = 90;
      PlayerObject.X = 0;
      PlayerObject.Y = -20;
      break;
    }
      
    case 3: {
      PlayerObject.Yaw = 270;
      PlayerObject.X = 0;
      PlayerObject.Y = 20;
      break;
    }
  }
};

var BoardObject = {
  Corner: true,
  Direction: 0,
  Max: 1,
  X: -1,
  Y: 0
};
var Boards = [ { Corner: true, Direction: 0, Max: 1, X: -1, Y: 0 } ];

var AddBoard = function() {
  PlayerObject.AddBoard = false;
  
  switch(BoardObject.Direction) {
    case 0: {
      BoardObject.X++;
      if(BoardObject.X == BoardObject.Max)
      {
        BoardObject.Direction = 1;
        BoardObject.Corner = true;
      }
      else
        BoardObject.Corner = false;
      break;
    }
        
    case 1: {
      BoardObject.Y++;
      if (BoardObject.Y == BoardObject.Max)
      {
        BoardObject.Direction = 2;
        BoardObject.Max *= -1;
        BoardObject.Corner = true;
      }
      else
        BoardObject.Corner = false;
      break;
    }
        
    case 2: {
      BoardObject.X--;
      if (BoardObject.X == BoardObject.Max)
      {
        BoardObject.Direction = 3;
        BoardObject.Corner = true;
      }
      else
        BoardObject.Corner = false;
      break;
    }
        
    case 3: {
      BoardObject.Y--;
      if (BoardObject.Y == BoardObject.Max)
      {
        BoardObject.Direction = 0;
        BoardObject.Max = (BoardObject.Max - 1) * -1;
        BoardObject.Corner = true;
      }
      else
        BoardObject.Corner = false;
      break;
    }
  }
  
  if(Boards.length == 1)
    BoardObject.Corner = true;
    
  Boards.push( { Requested: false, Corner: BoardObject.Corner, Direction: BoardObject.Direction, Max: BoardObject.Max, X: BoardObject.X, Y: BoardObject.Y } );
};

var RemoveBoard = function() {
  Boards.pop();
  BoardObject.Corner = Boards[Boards.length - 1].Corner;
  BoardObject.Direction = Boards[Boards.length - 1].Direction;
  BoardObject.Max = Boards[Boards.length - 1].Max;
  BoardObject.X = Boards[Boards.length - 1].X;
  BoardObject.Y = Boards[Boards.length - 1].Y;
  
  PlayerObject.AddBoard = true;
};

var Balls = [];

io.sockets.on('connection', function(socket) {
  if (PlayerObject.AddBoard) {
    AddBoard();
    socket.broadcast.emit('boardAdd', {Current: { Requested: false, Corner: BoardObject.Corner, Direction: BoardObject.Direction, Max: BoardObject.Max, X: BoardObject.X, Y: BoardObject.Y }, Previous: Boards[Boards.length - 2]}); //Add a new board for existing clients
  }
  
  socket.emit('boardData', {Boards: Boards, Balls: Balls}); //Sends all boards to the new player
  
  console.log(socket.id, " connected!");
  
  AddPlayer(socket.id);
  
  socket.broadcast.emit('playerAdd', { ID: PlayerObject.ID, Yaw: PlayerObject.Yaw, X: PlayerObject.X + BoardObject.X * 40, Y: PlayerObject.Y + BoardObject.Y * 40, Origin: {X: PlayerObject.X + BoardObject.X * 40, Y: PlayerObject.Y + BoardObject.Y * 40} });
  socket.emit('playerData', {ID: PlayerObject.ID, Players: Players});
  
  socket.on('positionUpdate', function (data) {
    Players[data.ID].X = data.X;
    Players[data.ID].Y = data.Y;
    Players[data.ID].Z = data.Z;
    
    socket.broadcast.emit('playerMoved', data);
  });
  
  socket.on('requestBall', function(data) {    
    if(!Boards[data.Index].Requested) {
      Boards[data.Index].Requested = true;
      
      socket.emit('addBall', {Index: data.Index, Direction: data.Direction});
      socket.broadcast.emit('addBall', {Index: data.Index, Direction: data.Direction});
      
      Balls.push({BoardIndex: data.Index, Position: {x: null, y: null}, Direction: data.Direction, Velocity: 25});
    }
  });
  
  socket.on('respondBall', function(index) {
    Boards[index].Requested = false;
  });
  
  socket.on('updateBall', function(data) {
    if(Balls[data.Index]) {
      Balls[data.Index].BoardIndex = data.BoardIndex;
      Balls[data.Index].Position = data.Position;
      Balls[data.Index].Direction = data.Direction;
      Balls[data.Index].Velocity = data.Velocity
    }
  });
  
  socket.on('removeBall', function(index) {
    Balls.splice(index, 1);
  });
  
  socket.on('disconnect', function () {
    console.log(socket.id, " disconnected!");
    
    if (io.engine.clientsCount < 1)
        process.exit(1);
    
    socket.broadcast.emit('playerRemove', { Replacer: PlayerObject.ID, Removed: socket.id, Origin: {X: Players[socket.id].Origin.X, Y: Players[socket.id].Origin.Y} });
    Players[PlayerObject.ID] = {ID: PlayerObject.ID, Yaw: Players[socket.id].Yaw, X: Players[socket.id].X, Y: Players[socket.id].Y, Origin: {X: Players[socket.id].Origin.X, Y: Players[socket.id].Origin.Y}};
    delete Players[socket.id];
    
    PlayerObject.Count--;
    if (PlayerObject.Count < 0)
      PlayerObject.Count = 0;
    
    if (PlayerObject.Count == 0) {
      if (io.engine.clientsCount == 3) {
        PlayerObject.Count = 2;
        PlayerObject.AddBoard = false;
      }
      else if (io.engine.clientsCount > 3) {
        RemoveBoard();
        socket.broadcast.emit('boardRemove');
      }
    }
  });
});

console.log("Server started");
server.listen(process.env.PORT);