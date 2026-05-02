# Local Nginx (http://localhost → Node :3000)

## 1. Config file

Use **`nginx.local.conf`** in this folder. It proxies to **`127.0.0.1:3000`** and serves static paths from your repo.

Edit **`set $PROJECT_ROOT`** if the project is not at:

`C:/Users/ASUS/Desktop/sarkari suchna india`

(On Linux/Mac, e.g. `set $PROJECT_ROOT /home/you/sarkari-suchna-india;`)

## 2. Where to put it

### Windows

1. Install Nginx (e.g. unzip from [nginx.org](https://nginx.org/en/download.html)).
2. Open **`conf/nginx.conf`** in the Nginx directory.
3. Inside **`http { ... }`**, add:
   ```nginx
   include C:/Users/ASUS/Desktop/sarkari suchna india/nginx/nginx.local.conf;
   ```
   (Adjust the path to match your machine, forward slashes work.)
4. **Port 80** needs an **Administrator** terminal to start Nginx, or change `listen 80` to `listen 8080` in `nginx.local.conf` and use **http://localhost:8080**.

### Linux (Debian/Ubuntu-style)

```bash
sudo cp /path/to/repo/nginx/nginx.local.conf /etc/nginx/sites-available/sarkari-local.conf
# Edit PROJECT_ROOT inside the file for Linux paths, then:
sudo ln -sf /etc/nginx/sites-available/sarkari-local.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Or include from `/etc/nginx/nginx.conf` under `http { }`:

```nginx
include /path/to/repo/nginx/nginx.local.conf;
```

## 3. App env

With Nginx in front, set in **`.env`**:

```env
TRUST_PROXY=1
```

## 4. Commands

| Action | Windows (in Nginx install folder) | Linux |
|--------|-------------------------------------|--------|
| Test config | `nginx -t` | `sudo nginx -t` |
| Start | `start nginx` | `sudo systemctl start nginx` |
| Reload | `nginx -s reload` | `sudo systemctl reload nginx` |
| Stop | `nginx -s quit` | `sudo systemctl stop nginx` |

## 5. Run order

1. Start Node: `npm start` (or `npm run dev`) — app on **port 3000**.
2. Start Nginx.
3. Open **http://localhost** (or **:8080** if you changed the port).
