const bcrypt = require("bcrypt");
const pool = require("./config/db"); // חשוב שהנתיב נכון

async function resetAdminPassword() {
    try {
        const newPassword = "Admin123!"; // 👉 הסיסמה החדשה שלך

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newPassword, salt);

        await pool.query(
            `UPDATE users SET password_hash=$1, salt=$2 WHERE username='admin'`,
            [hash, salt]
        );

        console.log("✅ Admin password reset successfully!");
        console.log("👉 Username: admin");
        console.log("👉 Password:", newPassword);

    } catch (err) {
        console.error("❌ Error:", err);
    } finally {
        await pool.end();
    }
}

resetAdminPassword();