create database tododb DEFAULT CHARACTER SET utf8 COLLATE utf8_general_ci;

-- Drop tables if they exist to prevent errors on re-creation
DROP TABLE IF EXISTS users;

-- Create the users table
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


-- Insert sample data
-- Note: Passwords are in plaintext as requested.

-- Insert admin user
INSERT INTO users (email, user_name, password) VALUES ('admin@example.com', 'Admin User', 'adminpass');

-- Insert regular users
INSERT INTO users (email, user_name, password) VALUES ('user1@example.com', 'Test User One', 'password');
INSERT INTO users (email, user_name, password) VALUES ('user2@example.com', 'Test User Two', 'password');

-- (Todo feature removed; todo table and sample data omitted)


## 권한 부여
CREATE USER 'todouser'@'X.X.X.X' IDENTIFIED BY '비밀번호';
GRANT ALL PRIVILEGES ON *.* TO 'todouser'@'X.X.X.X' WITH GRANT OPTION;
FLUSH PRIVILEGES;

-- Create posts and comments tables for bulletin board
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS posts;

CREATE TABLE posts (
    post_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    view_count INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE comments (
    comment_id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    user_id INT,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Sample posts
INSERT INTO posts (user_id, title, content) VALUES
    (2, '첫 번째 게시물입니다', '테스트용 샘플 게시물 내용입니다. 환영합니다!'),
    (3, '두번째 게시물', '두번째 게시물의 본문입니다. 게시판 기능 테스트용.'),
    (1, '관리자 공지', '관리자 계정으로 작성된 공지사항입니다.');

-- Sample comments
INSERT INTO comments (post_id, user_id, content) VALUES
    (1, 3, '좋은 글 감사합니다!'),
    (1, 2, '테스트 댓글입니다.'),
    (2, 2, '두번째 게시물에 대한 의견입니다.');
