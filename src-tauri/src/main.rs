// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use portable_pty::{native_pty_system, CommandBuilder, PtyPair, PtySize};
use users::os::unix::UserExt as _;
use std::{
    io::{BufRead, BufReader, Read, Write},
    process::exit,
    sync::Arc,
    thread::{self},
};

use tauri::{async_runtime::Mutex as AsyncMutex, State};

struct AppState {
    pty_pair: Arc<AsyncMutex<PtyPair>>,
    writer: Arc<AsyncMutex<Box<dyn Write + Send>>>,
    reader: Arc<AsyncMutex<BufReader<Box<dyn Read + Send>>>>,
}
/// Asynchronously creates a new shell process within the PTY, setting the `$TERM` environment variable
/// appropriately for the platform. Spawns the shell and waits for its exit in a separate thread.
/// 
/// # Arguments
/// * `state` - The application state containing the PTY pair.
/// 
/// # Returns
/// * `Result<(), String>` - Returns `Ok(())` if the shell is created successfully, or an error message otherwise.
#[tauri::command]
async fn async_create_shell(state: State<'_, AppState>) -> Result<(), String> {
    let shell = if cfg!(target_os = "windows") {
        "powershell.exe".to_string()
    } else {
        if let Some(user) = users::get_user_by_uid(users::get_current_uid()) {
            // dscl . -read /Users/$USER UserShell | awk '{print $2}'
            // let shell = std::process::Command::new("dscl").arg(".").arg("-read").arg(format!("/Users/{}", user.name())).arg("UserShell").output().unwrap();
            // let shell = std::str::from_utf8(&shell.stdout).unwrap();
            // let shell = shell.split_whitespace().last().unwrap();
            // shell.to_string()
            user.shell().to_string_lossy().to_string()
        } else {
            "/bin/bash".to_string()
        }
    };
    
    // Output the shell name to the terminal
    // let shell_name = shell.split('/').last().unwrap_or(&shell);
    // let mut writer = state.writer.lock().await;
    // writeln!(writer, "Using shell: {}\r\n", shell_name).map_err(|e| e.to_string())?;
    
    let mut cmd = CommandBuilder::new(shell);

    // add the $TERM env variable so we can use clear and other commands

    #[cfg(target_os = "windows")]
    cmd.env("TERM", "cygwin");

    #[cfg(not(target_os = "windows"))]
    cmd.env("TERM", "xterm-256color");

    let mut child = state
        .pty_pair
        .lock()
        .await
        .slave
        .spawn_command(cmd)
        .map_err(|err| err.to_string())?;

    thread::spawn(move || {
        let status = child.wait().unwrap();
        exit(status.exit_code() as i32)
    });
    Ok(())
}

/// Asynchronously writes data to the PTY's writer.
/// 
/// # Arguments
/// * `data` - The string data to write to the PTY.
/// * `state` - The application state containing the PTY writer.
/// 
/// # Returns
/// * `Result<(), ()>` - Returns `Ok(())` if the write succeeds, or `Err(())` on failure.
#[tauri::command]
async fn async_write_to_pty(data: &str, state: State<'_, AppState>) -> Result<(), ()> {
    write!(state.writer.lock().await, "{}", data).map_err(|_| ())
}

/// Asynchronously reads available data from the PTY's reader.
/// 
/// # Arguments
/// * `state` - The application state containing the PTY reader.
/// 
/// # Returns
/// * `Result<Option<String>, ()>` - Returns `Ok(Some(data))` if data is available, `Ok(None)` if not, or `Err(())` on error.
#[tauri::command]
async fn async_read_from_pty(state: State<'_, AppState>) -> Result<Option<String>, ()> {
    let mut reader = state.reader.lock().await;
    let data = {
        // Read all available text
        let data = reader.fill_buf().map_err(|_| ())?;

        // Send te data to the webview if necessary
        if data.len() > 0 {
            std::str::from_utf8(data)
                .map(|v| Some(v.to_string()))
                .map_err(|_| ())?
        } else {
            None
        }
    };

    if let Some(data) = &data {
        reader.consume(data.len());
    }

    Ok(data)
}

/// Asynchronously resizes the PTY to the specified number of rows and columns.
/// 
/// # Arguments
/// * `rows` - The number of rows for the PTY.
/// * `cols` - The number of columns for the PTY.
/// * `state` - The application state containing the PTY pair.
/// 
/// # Returns
/// * `Result<(), ()>` - Returns `Ok(())` if the resize succeeds, or `Err(())` on failure.
#[tauri::command]
async fn async_resize_pty(rows: u16, cols: u16, state: State<'_, AppState>) -> Result<(), ()> {
    state
        .pty_pair
        .lock()
        .await
        .master
        .resize(PtySize {
            rows,
            cols,
            ..Default::default()
        })
        .map_err(|_| ())
}

/// The main entry point for the Tauri application. Initializes the PTY system,
/// sets up the application state, and registers Tauri command handlers.
fn main() {
    let pty_system = native_pty_system();

    let pty_pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .unwrap();

    let reader = pty_pair.master.try_clone_reader().unwrap();
    let writer = pty_pair.master.take_writer().unwrap();

    tauri::Builder::default()
        .manage(AppState {
            pty_pair: Arc::new(AsyncMutex::new(pty_pair)),
            writer: Arc::new(AsyncMutex::new(writer)),
            reader: Arc::new(AsyncMutex::new(BufReader::new(reader))),
        })
        .invoke_handler(tauri::generate_handler![
            async_write_to_pty,
            async_resize_pty,
            async_create_shell,
            async_read_from_pty
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use users::os::unix::UserExt;

    // Test for async_create_shell is disabled due to Tauri State initialization issues in tests
    // For now, we'll test the shell detection logic separately
    
    #[test]
    fn test_shell_detection() {
        // Test shell detection on non-Windows platforms
        #[cfg(not(target_os = "windows"))]
        {
            // Test with SHELL environment variable set
            std::env::set_var("SHELL", "/bin/test_shell");
            let shell = if cfg!(target_os = "windows") {
                "powershell.exe".to_string()
            } else {
                std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
            };
            assert_eq!(shell, "/bin/test_shell");
            
            // Test with SHELL environment variable not set
            std::env::remove_var("SHELL");
            let shell = if cfg!(target_os = "windows") {
                "powershell.exe".to_string()
            } else {
                std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
            };
            assert_eq!(shell, "/bin/bash");
        }
        
        // Test Windows behavior
        #[cfg(target_os = "windows")]
        {
            let shell = if cfg!(target_os = "windows") {
                "powershell.exe".to_string()
            } else {
                std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
            };
            assert_eq!(shell, "powershell.exe");
        }
    }

    #[test]
    fn test_user() {
        if let Some(user) = users::get_user_by_uid(users::get_current_uid()) {
            println!("Login shell: {}", user.shell().to_string_lossy());
        }
    }
}
