PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS interactions (
	time_created	INTEGER NOT NULL,
	user_id	        TEXT NOT NULL,
	channel_id	    TEXT NOT NULL,
	input_msg_id	TEXT NOT NULL UNIQUE,
	data    	    TEXT NOT NULL,
    tokens_input    INTEGER,
    tokens_output   INTEGER,
    price           REAL
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
	time_created	INTEGER NOT NULL
);