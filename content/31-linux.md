---
id: linux
title: Linux & Shell Scripting
short: Linux
category: DevOps & Cloud
order: 17.5
color: #333333
icon: $_
summary: Filesystem, essential commands, permissions, processes, package management, networking tools, systemd, logs, Bash scripting, text processing and production troubleshooting.
---

# Beginner

## Linux Fundamentals and the Filesystem

Linux is the OS behind most servers, containers and cloud VMs. A **distribution** bundles the Linux kernel with tools and a package manager: **RHEL/Rocky/Alma/Fedora** (dnf/rpm), **Ubuntu/Debian** (apt/deb), Alpine (apk, common in containers), SUSE (zypper).

### Architecture
Hardware → **kernel** (process scheduling, memory, drivers, filesystems, networking) → system calls → shell and user programs. The **shell** (bash, zsh, sh) interprets commands.

### Filesystem Hierarchy
| Path | Contents |
|---|---|
| `/` | root of everything |
| `/etc` | configuration files |
| `/var` | variable data: logs (`/var/log`), caches, spools, databases |
| `/home/<user>`, `/root` | user home directories |
| `/usr/bin`, `/usr/local/bin` | user programs |
| `/bin`, `/sbin` | essential binaries (often symlinks to `/usr`) |
| `/tmp` | temporary files (often cleared on reboot) |
| `/opt` | optional/third-party software |
| `/proc`, `/sys` | virtual filesystems exposing kernel and process info |
| `/dev` | device files |
| `/mnt`, `/media` | mount points |
| `/boot` | kernel and bootloader |

"Everything is a file" — devices, processes (`/proc/<pid>`), sockets are accessed through the filesystem.

## Essential Commands

```bash
pwd                     # current directory
ls -lah                 # long list, all files, human sizes
cd /var/log && cd -     # change dir, go back
mkdir -p a/b/c          # create nested dirs
touch file.txt          # create empty file / update timestamp
cp -r src/ dst/         # copy recursively
mv old new              # move/rename
rm -rf dir/             # delete recursively — careful!
ln -s /opt/app/current app   # symbolic link
cat file; less file; head -n 20 file; tail -f app.log     # view files, follow logs
find /var/log -name "*.log" -mtime +7 -size +100M         # find files
grep -rni "error" /var/log/app/                           # search text recursively
wc -l file; sort file | uniq -c | sort -rn                # count, frequency
du -sh *; df -h                                           # disk usage per dir; filesystem free space
which python3; type ls; man grep; history                 # locate commands, docs, history
tar -czvf backup.tgz dir/; tar -xzvf backup.tgz           # archive/compress
```

### Redirection and pipes
```bash
cmd > out.txt       # stdout to file (overwrite)
cmd >> out.txt      # append
cmd 2> err.txt      # stderr
cmd > all.log 2>&1  # both stdout and stderr
cmd < input.txt     # stdin from file
cmd1 | cmd2         # pipe stdout of cmd1 into cmd2
cmd | tee out.txt   # show and save
```

## Users, Groups and Permissions

```bash
id; whoami
sudo useradd -m -s /bin/bash deploy && sudo passwd deploy
sudo usermod -aG docker deploy           # add to supplementary group
sudo visudo                              # edit sudoers safely
```

### Permission model
```text
-rwxr-x---  1 deploy devs  4096 Oct 21 app.sh
│└┬┘└┬┘└┬┘
│ │  │  └── others: no access
│ │  └───── group (devs): read + execute
│ └──────── owner (deploy): read + write + execute
└────────── type: - file, d directory, l link
```
| Permission | File | Directory |
|---|---|---|
| r (4) | read content | list entries |
| w (2) | modify | create/delete entries |
| x (1) | execute | enter (`cd`) and access entries |

```bash
chmod 750 app.sh            # rwx r-x ---
chmod u+x,g-w file          # symbolic
chown deploy:devs app.sh    # change owner and group
chmod -R g+rwX shared/      # X = execute only on directories (and already-executable files)
umask 022                   # default permissions mask for new files (644) and dirs (755)
```

### Special permissions
- **setuid** (`4xxx`, `s` in owner execute) — run as file owner (e.g., `passwd`).
- **setgid** (`2xxx`) — run as group; on directories, new files inherit the group.
- **sticky bit** (`1xxx`, `t`) — on directories like `/tmp`, only owners can delete their files.
- **ACLs** (`setfacl`/`getfacl`) for fine-grained permissions; **SELinux/AppArmor** add mandatory access control.

## Processes and Package Management

```bash
ps aux | grep java          # all processes
pgrep -fl nginx             # find by name
top / htop                  # live CPU/memory view
kill <pid>                  # SIGTERM (graceful)
kill -9 <pid>               # SIGKILL (force — last resort)
pkill -f "python worker.py"
nohup ./job.sh &            # run in background, survives logout
jobs; fg %1; bg %1          # job control
nice -n 10 ./batch.sh; renice -n 5 -p <pid>   # priorities
```

### Signals
`SIGTERM (15)` polite stop · `SIGKILL (9)` cannot be caught · `SIGINT (2)` Ctrl+C · `SIGHUP (1)` reload config / terminal closed · `SIGSTOP`/`SIGCONT` pause/resume.

### Process states
Running (R), sleeping (S), uninterruptible sleep (D — usually I/O), stopped (T), **zombie** (Z — finished but parent hasn't reaped it).

### Package management
```bash
# Debian/Ubuntu
sudo apt update && sudo apt install -y nginx && sudo apt upgrade
apt list --installed | grep nginx
# RHEL/Fedora
sudo dnf install -y nginx && sudo dnf update
rpm -qa | grep nginx
```

# Intermediate

## systemd, Services and Logs

```bash
sudo systemctl start|stop|restart|reload nginx
sudo systemctl enable --now nginx      # start now and at boot
systemctl status nginx
systemctl list-units --type=service --state=failed
journalctl -u nginx -f                 # follow service logs
journalctl -u myapp --since "1 hour ago" -p err
journalctl -b                          # logs since boot
```

```ini /etc/systemd/system/shop-api.service
[Unit]
Description=Shop API
After=network-online.target
Wants=network-online.target

[Service]
User=deploy
WorkingDirectory=/opt/shop-api
EnvironmentFile=/etc/shop-api/env
ExecStart=/opt/shop-api/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=on-failure
RestartSec=5
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload && sudo systemctl enable --now shop-api
```

### Logs
`/var/log/syslog` or `/var/log/messages`, `/var/log/auth.log` / `secure` (logins, sudo), application logs under `/var/log/<app>`, `dmesg` (kernel ring buffer — OOM killer, disk errors). **logrotate** rotates and compresses logs.

### Scheduling
```bash
crontab -e
# m h dom mon dow  command
*/5 * * * * /opt/scripts/health-check.sh >> /var/log/health.log 2>&1
0 2 * * 0   /opt/scripts/weekly-backup.sh
```
systemd **timers** are the modern alternative (logging, dependencies, missed-run handling).

## Networking Commands

```bash
ip a                         # interfaces and IPs (ifconfig is legacy)
ip r                         # routing table
ss -tulpn                    # listening ports and owning processes (netstat is legacy)
ping -c 4 google.com
traceroute / mtr api.example.com
dig api.example.com +short; nslookup api.example.com    # DNS
curl -v https://api.example.com/health                  # HTTP debugging (-I headers, -k skip TLS verify)
curl -w "%{http_code} %{time_total}\n" -o /dev/null -s https://site
nc -zv db.internal 5432      # test TCP port reachability
telnet host 25               # legacy port test
openssl s_client -connect site:443 -servername site     # inspect TLS certificate
tcpdump -i eth0 port 443 -nn # capture packets
ssh -i key.pem user@host; scp file user@host:/tmp; rsync -avz src/ user@host:/dst/
ssh -L 5432:db.internal:5432 bastion   # local port forward through a bastion
```

### Firewalls
`firewalld` (`firewall-cmd --add-port=8080/tcp --permanent && firewall-cmd --reload`) on RHEL; `ufw` on Ubuntu; underlying `nftables`/`iptables`.

### Important files
`/etc/hosts` (local name overrides), `/etc/resolv.conf` (DNS servers), `/etc/ssh/sshd_config` (disable root login and password auth; use keys).

## Text Processing: grep, sed, awk, cut, xargs

```bash
grep -E "ERROR|WARN" app.log | grep -v healthcheck            # regex, exclude
grep -c "500" access.log                                      # count matches
grep -o '"userId":"[^"]*"' events.log | sort | uniq -c        # extract
sed -i 's/localhost/db.internal/g' config.ini                 # in-place replace
sed -n '100,120p' big.log                                      # print line range
awk '{print $1}' access.log | sort | uniq -c | sort -rn | head # top client IPs
awk -F, '$3 > 1000 {sum += $3} END {print sum}' orders.csv    # sum column 3 where > 1000
awk '$9 >= 500 {print $7}' access.log | sort | uniq -c | sort -rn | head   # top failing URLs (nginx log)
cut -d: -f1 /etc/passwd                                        # field extraction
find . -name "*.tmp" -print0 | xargs -0 rm -f                  # bulk operations safely
jq '.items[] | select(.status=="FAILED") | .id' result.json    # JSON processing
```

## Bash Scripting

```bash deploy.sh
#!/usr/bin/env bash
set -euo pipefail                 # exit on error, unset vars are errors, fail pipelines
IFS=$'\n\t'

readonly APP_DIR="/opt/shop-api"
LOG_FILE="/var/log/deploy.log"
VERSION="${1:?Usage: $0 <version>}"     # required argument

log() { echo "$(date '+%F %T') [$1] ${*:2}" | tee -a "$LOG_FILE"; }
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT                 # always run cleanup
trap 'log ERROR "failed at line $LINENO"' ERR

TMP_DIR="$(mktemp -d)"

log INFO "Deploying version $VERSION"
if ! curl -fsSL "https://artifacts.example.com/shop-api-$VERSION.tgz" -o "$TMP_DIR/app.tgz"; then
  log ERROR "Download failed"; exit 1
fi

tar -xzf "$TMP_DIR/app.tgz" -C "$APP_DIR"
sudo systemctl restart shop-api

for i in {1..10}; do
  if curl -fs http://localhost:8000/healthz > /dev/null; then
    log INFO "Healthy after $i checks"; exit 0
  fi
  sleep 3
done
log ERROR "Service unhealthy"; exit 1
```

### Essentials
- Variables: `name="x"` (no spaces), `"$name"` (always quote), `${name:-default}`, `${#name}` (length), `${file%.log}` (strip suffix).
- Command substitution: `today=$(date +%F)`. Arithmetic: `$(( a + b ))`.
- Conditions: `[[ -f file ]]` (file exists), `-d` dir, `-z "$s"` empty, `-n` non-empty, `==`, `=~` regex, `-eq -lt -gt` numbers; `&&` / `||`.
- Loops: `for f in *.log; do …; done`, `while read -r line; do …; done < file`.
- Functions with `local` variables; return codes via `return`/`$?`; exit codes (0 success).
- Arguments: `$0`, `$1…`, `$#` (count), `$@` (all, quoted individually), `getopts` for flags.
- Lint with **ShellCheck**.

# Advanced

## Performance Troubleshooting

### A systematic approach (USE method: Utilization, Saturation, Errors)
```bash
uptime                      # load averages (1, 5, 15 min) vs CPU count (nproc)
top / htop                  # CPU hogs, %wa (I/O wait), memory
vmstat 1 5                  # run queue (r), swap (si/so), I/O wait
mpstat -P ALL 1             # per-CPU usage
free -h                     # memory: "available" matters more than "free" (cache is reclaimable)
iostat -xz 1                # disk utilisation, await latency
iotop                       # per-process disk I/O
sar -n DEV 1                # network throughput
ss -s                       # socket summary (connections, TIME_WAIT)
lsof -p <pid> | wc -l       # open files of a process; lsof -i :8080 who uses a port
strace -p <pid> -f -e trace=network   # syscalls of a process
perf top                    # CPU profiling
dmesg -T | grep -i -E "oom|error"     # kernel messages: OOM kills, hardware errors
```

### Common scenarios
| Symptom | Investigation |
|---|---|
| High load but low CPU | processes in **D state** waiting on I/O → `iostat`, `iotop`, check NFS/disk |
| Disk full | `df -h` → `du -xsh /* \| sort -h` → large logs; **deleted but open files** still using space: `lsof +L1` (restart the process or truncate) |
| Inodes exhausted (`No space left` but df shows space) | `df -i`; many tiny files (sessions, caches) |
| Process killed unexpectedly | `dmesg` / `journalctl -k` for **OOM killer**; check cgroup/container memory limits |
| "Too many open files" | `ulimit -n`, `LimitNOFILE` in systemd unit, connection leaks |
| Port already in use | `ss -tulpn \| grep :8080` → find PID |
| Slow DNS / network | `dig`, `/etc/resolv.conf`, `mtr`, `tcpdump` |
| Service won't start | `systemctl status`, `journalctl -u svc -xe`, permissions, SELinux denials (`ausearch -m avc`, `sealert`) |

## Kernel, Memory, Boot and Containers Under the Hood

### Boot process
BIOS/UEFI → bootloader (GRUB2) → kernel + initramfs → **systemd** (PID 1) → targets (`multi-user.target`, `graphical.target`) → services.

### Memory concepts
Virtual memory per process, paging, **page cache** (free memory is used for caching files — that's good), swap, `overcommit`, OOM killer choosing victims by `oom_score`, huge pages for databases/JVMs.

### Kernel tuning
`sysctl -a`, persistent in `/etc/sysctl.d/*.conf`: `net.core.somaxconn`, `net.ipv4.ip_local_port_range`, `vm.swappiness`, `fs.file-max`, `vm.max_map_count` (Elasticsearch).

### Storage
Partitions (`lsblk`, `fdisk`, `parted`), filesystems (ext4, **XFS** default on RHEL, btrfs), `mount` and `/etc/fstab` (use UUIDs; `nofail` for optional disks), **LVM** (physical volumes → volume groups → logical volumes; resize online with `lvextend -r`), RAID, NFS.

### Containers are Linux features
**Namespaces** (pid, net, mnt, uts, ipc, user, cgroup) for isolation + **cgroups** v2 for resource limits + overlay filesystems + capabilities/seccomp/SELinux for security. `nsenter`, `/sys/fs/cgroup`, and `systemd-cgls` let you inspect them on a host.

## Security Hardening

- Keep systems patched (unattended-upgrades / `dnf-automatic`).
- SSH: keys only, disable root login and password auth, change/limit exposure via bastion or VPN, **fail2ban**, MFA where possible.
- Least privilege: separate service accounts, minimal sudo rules, no world-writable files (`find / -perm -0002 -type f`).
- Firewall default-deny inbound; expose only needed ports.
- **SELinux** (enforcing on RHEL — use `semanage`, `restorecon`, booleans instead of disabling) / AppArmor.
- Audit with `auditd`, centralise logs (rsyslog/journald → SIEM), file integrity monitoring (AIDE).
- Remove unused packages/services; disable unused ports (`ss -tulpn`).
- CIS benchmarks and automated compliance scans (OpenSCAP, Lynis).
- Encrypt disks (LUKS) and secrets; rotate credentials.

# Interview Questions

## Beginner

### How do you check disk space and find what's using it?
`df -h` shows free space per filesystem; `du -sh /path/*` (or `du -xsh /* | sort -h`) shows which directories use the most space. Also check inode usage with `df -i` and deleted-but-open files with `lsof +L1`.

### Explain Linux file permissions.
Each file has owner, group and others permissions of read (4), write (2) and execute (1). `chmod 755` gives the owner rwx and others r-x. On directories, x allows entering and r allows listing. `chown` changes ownership.

### How do you find a process using a port and stop it?
`ss -tulpn | grep :8080` (or `lsof -i :8080`) shows the PID; stop it gracefully with `kill <pid>` (SIGTERM) and use `kill -9` only if it doesn't exit. For services, prefer `systemctl stop <service>`.

### What is the difference between a hard link and a soft link?
A hard link is another directory entry pointing to the same inode — it works even if the original name is removed but can't cross filesystems or link directories. A symbolic (soft) link is a separate file containing a path — it can cross filesystems and point to directories but breaks if the target is removed.

### How do you view logs in real time?
`tail -f /var/log/app.log` for files, `journalctl -u <service> -f` for systemd services, and `kubectl logs -f` or `docker logs -f` in containers.

### What does `chmod 777` mean and why is it dangerous?
It grants read, write and execute permissions to everyone. Any user or compromised process could modify or replace the file, so it's a common security hole; grant the minimum necessary permissions instead.

## Intermediate

### What is the difference between SIGTERM and SIGKILL?
SIGTERM (15) asks a process to terminate and can be caught so it can clean up gracefully. SIGKILL (9) immediately terminates it at the kernel level and can't be caught or ignored — no cleanup happens.

### What is a zombie process?
A process that has finished executing but still has an entry in the process table because its parent hasn't read its exit status (`wait()`). Zombies consume a PID but no resources; fix by fixing or restarting the parent process (or ensuring an init like tini reaps children in containers).

### How do you create a systemd service for an application?
Write a unit file in `/etc/systemd/system/<name>.service` with `[Unit]`, `[Service]` (User, WorkingDirectory, ExecStart, Restart, EnvironmentFile) and `[Install]` sections, then run `systemctl daemon-reload` and `systemctl enable --now <name>`; check with `systemctl status` and `journalctl -u`.

### What does `set -euo pipefail` do in Bash?
`-e` exits on any command failure, `-u` treats unset variables as errors, and `-o pipefail` makes a pipeline fail if any command in it fails — making scripts fail fast instead of continuing in a broken state.

### How do you find the top 10 IP addresses in an access log?
`awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -10` — extract the first field, count unique values, sort by count descending and take the top ten.

### What is load average?
The average number of processes running or waiting for CPU (and, on Linux, in uninterruptible I/O wait) over 1, 5 and 15 minutes. Compare it with the number of CPU cores: a load consistently above the core count indicates saturation.

## Advanced

### A server is slow — how do you troubleshoot it?
Check `uptime` load versus cores, then `top`/`htop` for CPU-heavy processes and I/O wait, `free -h` and `vmstat` for memory pressure and swapping, `iostat`/`iotop` for disk latency, `ss`/`sar` for network issues, `dmesg` for OOM or hardware errors, and application logs. Then drill into the culprit process with `strace`, `perf` or language-specific profilers.

### The disk shows full but you can't find large files. Why?
Most likely a process still holds deleted files open (common with rotated logs), so space isn't released — find them with `lsof +L1` and restart or truncate. Other causes: inode exhaustion (`df -i`), files hidden under a mount point, or reserved blocks for root.

### How does the OOM killer work?
When the kernel can't satisfy memory allocations, it selects a process to kill based on its `oom_score` (memory usage, adjusted by `oom_score_adj`) and sends SIGKILL. In containers, cgroup memory limits trigger OOM kills within the cgroup. Logs appear in `dmesg`/`journalctl -k`.

### How would you harden a Linux server?
Patch regularly, use SSH keys with root login and passwords disabled, restrict access via firewall and bastion, apply least privilege with dedicated users and limited sudo, keep SELinux enforcing, remove unused services, enable auditing and central logging, run CIS benchmark scans and encrypt sensitive data.

### Explain how Linux namespaces and cgroups enable containers.
Namespaces isolate what a process can see — its own PIDs, network stack, mounts, hostname, IPC and user IDs. Cgroups limit and account for resources like CPU, memory, I/O and PIDs. Combined with layered filesystems and security modules, they make an ordinary process behave like an isolated container.

# Scenario Questions

## Beginner

### The server says "No space left on device", but `df -h` shows free space. What's going on?
You've run out of **inodes** (millions of tiny files): check `df -i`. Or a **deleted file is still held open** by a process, so the space isn't freed until it closes: `lsof +L1` finds it, then restart the process. Also check that you're looking at the right mount point.

### A script works when you run it, but fails from cron. Why?
Cron runs with a **minimal environment**: a different `PATH`, no `.bashrc`/profile, a different working directory and `sh` instead of `bash`. Use absolute paths, set `PATH` and `SHELL` in the crontab, `cd` into the right directory, and redirect output to a log (`>> /var/log/job.log 2>&1`) to see the errors.

## Intermediate

### The server load average is 30 on a 4-core machine, but CPU usage is low. What do you check?
Load average counts processes **waiting for I/O** (D state), not just those running on CPU. Check `top`/`htop` for `wa` (I/O wait), `iostat -x 1` for disk saturation, `vmstat 1` for swapping, and NFS mounts that hang. Find the processes with `iotop` or `ps -eo state,pid,cmd | grep '^D'`.

### A web server is slow and you suspect memory. How do you confirm it?
- `free -h`: remember that "available" matters, not "free", because Linux uses spare RAM for cache.
- `vmstat 1`: watch `si/so` for swapping.
- `dmesg | grep -i oom`: check for OOM kills.
- `ps aux --sort=-%mem | head`: find the biggest processes.
- `/proc/<pid>/status`: per-process detail.

## Advanced

### Production servers occasionally can't open new connections: "Too many open files". How do you fix it?
The process has hit its **file-descriptor limit**. Check `ulimit -n` and `cat /proc/<pid>/limits`, and count open fds with `ls /proc/<pid>/fd | wc -l`. Raise the limit in the systemd unit (`LimitNOFILE=`) or `/etc/security/limits.conf`. Also look for fd leaks (sockets and files never closed), and tune `net.ipv4.ip_local_port_range` and TIME_WAIT reuse for outbound-heavy services.

# Tricky Questions

## Beginner

### What's the difference? `cmd > out.txt 2>&1` vs `cmd 2>&1 > out.txt`
Redirections are processed **left to right**. In the first, stdout goes to the file and then stderr is pointed at where stdout now points (the file), so both end up in the file. In the second, stderr is pointed at the *current* stdout (the terminal) and only then is stdout redirected to the file, so errors still appear on screen.

### Why does `rm -rf $DIR/` scare reviewers?
If `DIR` is empty or unset, the command becomes `rm -rf /`. Quote variables, and fail on unset ones with `set -u` or `${DIR:?DIR not set}`. Start scripts with `set -euo pipefail`.

## Intermediate

### What does this print? `count=0; cat file.txt | while read line; do count=$((count+1)); done; echo $count`
**0**. Each part of a pipeline runs in a **subshell**, so the loop's `count` is lost. Use redirection instead, `while read -r line; do …; done < file.txt`, or `shopt -s lastpipe`.

### `chmod 644` on a directory: can users `cd` into it?
**No.** On directories, `x` (execute) means permission to traverse or enter, and `r` only lets you list names. Directories usually need `755` (or `750`), and files `644`.
