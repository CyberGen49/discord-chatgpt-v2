PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS interactions (
	time_created	INTEGER NOT NULL,
	user_id	        TEXT NOT NULL,
	channel_id	    TEXT NOT NULL,
	input_msg_id	TEXT NOT NULL UNIQUE,
	data    	    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS response_messages (
	input_msg_id	TEXT NOT NULL,
    msg_id          TEXT NOT NULL UNIQUE,
    content         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
	user_id     	TEXT NOT NULL UNIQUE,
    is_allowed      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS stats (
	user_id			TEXT NOT NULL,
	time_created	INTEGER NOT NULL,
	type			TEXT NOT NULL,
	tokens_in		INTEGER,
	tokens_out		INTEGER,
	price			REAL,
	function_name	TEXT
);