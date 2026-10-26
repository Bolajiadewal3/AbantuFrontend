const { execFileSync, spawn } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");
const path = require("node:path");
const bcrypt = require("bcryptjs");

const frontendDirectory = path.resolve(__dirname, "..");
const backendDirectory = path.resolve(frontendDirectory, "../../CareApp.Backend");
const webApiProject = path.join(backendDirectory, "CareApp.WebApi/CareApp.WebApi.csproj");
const databaseName = "careapp_e2e";
const databasePassword = "careapp-e2e-only";
const jwtKey = "CareApp E2E test signing key with 32 bytes minimum";
const carerEmail = "e2e.carer@example.test";
const carerPassword = "E2E-care-passphrase-123!";
const adminEmail = "e2e.admin@example.test";
const adminPassword = "E2E-admin-passphrase-123!";
const apiPort = process.env.CAREAPP_E2E_API_PORT || "5144";
const frontendPort = process.env.CAREAPP_E2E_FRONTEND_PORT || "5175";
const apiUrl = `http://localhost:${apiPort}`;

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

function executeSql(containerName, sql) {
  return run("docker", [
    "exec",
    containerName,
    "psql",
    "-U",
    "postgres",
    "-d",
    databaseName,
    "-v",
    "ON_ERROR_STOP=1",
    "-t",
    "-A",
    "-c",
    sql,
  ]);
}

function executeScalar(containerName, sql) {
  const valueLines = executeSql(containerName, sql)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d+$/.test(line));
  const value = valueLines.at(-1);
  if (!value) throw new Error("Expected SQL command to return a numeric identifier.");
  return Number(value);
}

async function waitForApi(apiProcess, getOutput) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (apiProcess.exitCode !== null) {
      throw new Error(`Test API exited before readiness.\n${getOutput()}`);
    }
    try {
      const response = await fetch(`${apiUrl}/weatherforecast`);
      if (response.ok) return;
    } catch {
      await delay(500);
    }
  }
  throw new Error(`Test API did not become ready within 120 seconds.\n${getOutput()}`);
}

async function seedDatabase(containerName) {
  const passwordHash = await bcrypt.hash(carerPassword, 10);
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
  const userId = executeScalar(containerName, `
    INSERT INTO "Users" ("Email", "PasswordHash", "FirstName", "LastName", "Role", "MaxWeeklyHours", "IsActive", "CreatedAt")
    VALUES ('${carerEmail}', '${passwordHash}', 'E2E', 'Carer', 'Carer', 48, TRUE, NOW())
    RETURNING "Id";
  `);
  executeSql(containerName, `
    INSERT INTO "Users" ("Email", "PasswordHash", "FirstName", "LastName", "Role", "MaxWeeklyHours", "IsActive", "CreatedAt")
    VALUES ('${adminEmail}', '${adminPasswordHash}', 'E2E', 'Admin', 'Admin', 48, TRUE, NOW());
  `);
  const locationId = executeScalar(containerName, `
    INSERT INTO "Locations" ("Name", "Address", "IsActive", "CreatedAt")
    VALUES ('E2E Care Location', 'Test address', TRUE, NOW())
    RETURNING "Id";
  `);

  const createShift = (startOffsetHours, endOffsetHours, shiftStatus, assignmentStatus, actualStartSql = "NULL") => {
    const shiftId = executeScalar(containerName, `
      INSERT INTO "Shifts" ("ClientId", "CreatedAt", "EndTime", "IsRecurring", "LocationId", "RecurrenceRule", "RequiredCarers", "StartTime", "Status", "UpdatedAt")
      VALUES (NULL, NOW(), NOW() + INTERVAL '${endOffsetHours} hours', FALSE, ${locationId}, NULL, 1, NOW() + INTERVAL '${startOffsetHours} hours', '${shiftStatus}', NULL)
      RETURNING "Id";
    `);
    const assignmentStatusValue = {
      Assigned: 0,
      ClockedIn: 1,
      Completed: 2,
      LeftEarly: 3,
      NoShow: 4,
      Accepted: 5,
    }[assignmentStatus];
    if (assignmentStatusValue === undefined) throw new Error(`Unknown assignment status: ${assignmentStatus}`);
    const acceptedAt = assignmentStatus === "Accepted" ? "NOW()" : "NULL";
    executeSql(containerName, `
      INSERT INTO "ShiftCarerAssignment" ("ShiftId", "CarerId", "Status", "AcceptedAt", "ActualStartTime", "ActualEndTime", "IsReplacement")
      VALUES (${shiftId}, ${userId}, ${assignmentStatusValue}, ${acceptedAt}, ${actualStartSql}, NULL, FALSE);
    `);
    return shiftId;
  };

  createShift(48, 50, "Scheduled", "Assigned");
  createShift(72, 74, "Scheduled", "Accepted");
  createShift(-4, -3, "InProgress", "ClockedIn", "NOW() - INTERVAL '4 hours'");

  executeSql(containerName, `
    INSERT INTO "Payslips" ("UserId", "PayPeriodStart", "PayPeriodEnd", "GrossPay", "NetPay", "PdfFilePath", "HasDispute", "CreatedAt")
    VALUES (${userId}, NOW() - INTERVAL '14 days', NOW(), 1000, 800, '/tmp/e2e-payslip-not-present.pdf', FALSE, NOW());
  `);
}

async function startE2EEnvironment() {
  const containerName = `careapp-e2e-postgres-${process.pid}`;
  let apiProcess;
  let apiOutput = "";

  try {
    run("docker", [
      "run",
      "--detach",
      "--rm",
      "--name",
      containerName,
      "--env",
      `POSTGRES_PASSWORD=${databasePassword}`,
      "--env",
      `POSTGRES_DB=${databaseName}`,
      "--publish",
      "127.0.0.1::5432",
      "postgres:16-alpine",
    ]);
    const portOutput = run("docker", ["port", containerName, "5432/tcp"]);
    const portMatch = portOutput.match(/:(\d+)\s*$/);
    if (!portMatch) throw new Error(`Could not determine test database port: ${portOutput}`);

    const databaseDeadline = Date.now() + 60_000;
    let databaseReady = false;
    while (Date.now() < databaseDeadline) {
      try {
        run("docker", ["exec", containerName, "pg_isready", "-U", "postgres", "-d", databaseName]);
        const queryResult = run("docker", [
          "exec",
          containerName,
          "psql",
          "-U",
          "postgres",
          "-d",
          databaseName,
          "-t",
          "-A",
          "-c",
          "SELECT 1;",
        ]);
        if (queryResult === "1") {
          databaseReady = true;
          break;
        }
      } catch {
        await delay(500);
      }
    }
    if (!databaseReady) throw new Error("Disposable PostgreSQL did not finish initialization within 60 seconds.");

    const connectionString = `Host=127.0.0.1;Port=${portMatch[1]};Database=${databaseName};Username=postgres;Password=${databasePassword}`;
    apiProcess = spawn("dotnet", ["run", "--project", webApiProject, "--no-restore", "--no-launch-profile"], {
      cwd: backendDirectory,
      env: {
        ...process.env,
        ASPNETCORE_ENVIRONMENT: "Development",
        ASPNETCORE_URLS: `http://0.0.0.0:${apiPort}`,
        ConnectionStrings__DefaultConnection: connectionString,
        JwtSettings__Key: jwtKey,
        JwtSettings__Issuer: "CareAppBackend",
        JwtSettings__Audience: "CareAppFrontend",
        PasswordReset__FrontendUrl: `http://localhost:${frontendPort}`,
        Cors__AllowedOrigins__0: `http://localhost:${frontendPort}`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const keepOutput = (chunk) => {
      apiOutput = `${apiOutput}${chunk.toString()}`.slice(-12_000);
    };
    apiProcess.stdout.on("data", keepOutput);
    apiProcess.stderr.on("data", keepOutput);

    await waitForApi(apiProcess, () => apiOutput);
    await seedDatabase(containerName);

    return async () => {
      if (apiProcess.exitCode === null) {
        apiProcess.kill("SIGTERM");
        await Promise.race([
          new Promise((resolve) => apiProcess.once("exit", resolve)),
          delay(5_000),
        ]);
        if (apiProcess.exitCode === null) apiProcess.kill("SIGKILL");
      }
      try {
        run("docker", ["stop", containerName]);
      } catch {
        // The disposable container may already have stopped.
      }
    };
  } catch (error) {
    if (apiProcess && apiProcess.exitCode === null) apiProcess.kill("SIGTERM");
    try {
      run("docker", ["stop", containerName]);
    } catch {
      // Clean only the container created by this setup.
    }
    throw error;
  }
}

async function hasSeededE2EApi() {
  try {
    const response = await fetch(`${apiUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: carerEmail, password: carerPassword }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

module.exports = { hasSeededE2EApi, startE2EEnvironment };