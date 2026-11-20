// Machine status light reader. One sketch for all six boards.
//
// Before uploading: set THIS_BOARD to the machine this board is going on.
//
// Answers any HTTP request on port 8193 with:
//   {"green":true,"yellow":false,"red":false,"greenStarts":12,"greenMs":492000,"uptimeMs":86400000}
//
// greenStarts and greenMs are running totals since the board started. uptimeMs going backwards
// means the board restarted and the totals began again. Both counters wrap at 2^32.

#include <SPI.h>
#include <Ethernet.h>
#include <avr/wdt.h>

enum Board { ML1, ML2, ML3, ME1, MZL, MZM };

const Board THIS_BOARD = MZM;

struct BoardConfig {
  byte macEnd[3];
  // How long yellow and red stay on after their input goes off. Only for flashing lights: must be
  // longer than the light's off time.
  unsigned long flashHoldMs;
};

const BoardConfig BOARDS[] = {
  /* ML1 */ { { 0xAE, 0xA9, 0x7E }, 0 },
  /* ML2 */ { { 0xAE, 0x94, 0xCD }, 0 },
  /* ML3 */ { { 0xAE, 0x94, 0xB4 }, 0 },
  /* ME1 */ { { 0xAE, 0xA8, 0x34 }, 3000 },  // Flashes about 1s on, 1s off
  /* MZL */ { { 0xAE, 0xE0, 0xF4 }, 0 },
  /* MZM */ { { 0xAE, 0xA8, 0x2E }, 0 },
};

const byte RED_PIN = 5;
const byte YELLOW_PIN = 6;
const byte GREEN_PIN = 7;

const unsigned long DEBOUNCE_MS = 50;
const unsigned long CLIENT_TIMEOUT_MS = 1000;
// DHCP has to give up before the 8s watchdog fires, so a slow server can't look like a hang.
const unsigned long DHCP_TIMEOUT_MS = 6000;
const unsigned long DHCP_RESPONSE_TIMEOUT_MS = 2000;

struct Light {
  byte pin;
  unsigned long holdMs;
  bool raw;
  bool stable;
  bool held;
  unsigned long rawSince;
  unsigned long lastOn;
};

Light red = { RED_PIN, 0, false, false, false, 0, 0 };
Light yellow = { YELLOW_PIN, 0, false, false, false, 0, 0 };
Light green = { GREEN_PIN, 0, false, false, false, 0, 0 };

unsigned long greenStarts = 0;
unsigned long greenMs = 0;
unsigned long lastSample = 0;

EthernetServer server(8193);

// Nothing resets the watchdog from here, so the board restarts and tries again.
void waitForWatchdogRestart() {
  while (true) {}
}

void setup() {
  // Started first so a chip that isn't ready, or no DHCP server, retries instead of stopping for good.
  wdt_enable(WDTO_8S);

  pinMode(GREEN_PIN, INPUT_PULLUP);
  pinMode(YELLOW_PIN, INPUT_PULLUP);
  pinMode(RED_PIN, INPUT_PULLUP);

  const BoardConfig &config = BOARDS[THIS_BOARD];
  red.holdMs = config.flashHoldMs;
  yellow.holdMs = config.flashHoldMs;

  byte mac[] = { 0xA8, 0x61, 0x0A, config.macEnd[0], config.macEnd[1], config.macEnd[2] };

  int gotAddress = Ethernet.begin(mac, DHCP_TIMEOUT_MS, DHCP_RESPONSE_TIMEOUT_MS);
  if (Ethernet.hardwareStatus() == EthernetNoHardware || !gotAddress) {
    waitForWatchdogRestart();
  }
  wdt_reset();

  server.begin();
  lastSample = millis();
}

void loop() {
  wdt_reset();
  sampleLights();

  // Keeps DHCP lease alive on long uptimes
  Ethernet.maintain();

  EthernetClient client = server.available();
  if (client) {
    handleClient(client);
  }
}

// Returns true when the input has settled on a new value.
bool updateLight(Light &light, unsigned long now) {
  bool on = digitalRead(light.pin) == LOW;
  if (on != light.raw) {
    light.raw = on;
    light.rawSince = now;
  }

  bool changed = false;
  if (light.stable != light.raw && now - light.rawSince >= DEBOUNCE_MS) {
    light.stable = light.raw;
    changed = true;
  }

  if (light.stable) {
    light.held = true;
    light.lastOn = now;
  } else if (light.held && now - light.lastOn >= light.holdMs) {
    light.held = false;
  }
  return changed;
}

void sampleLights() {
  unsigned long now = millis();

  updateLight(red, now);
  updateLight(yellow, now);
  if (green.stable) {
    greenMs += now - lastSample;
  }
  if (updateLight(green, now) && green.stable) {
    greenStarts++;
  }

  lastSample = now;
}

bool isOn(const Light &light) {
  return light.stable || light.held;
}

void handleClient(EthernetClient &client) {
  unsigned long start = millis();
  bool currentLineIsBlank = true;

  while (client.connected()) {
    wdt_reset();
    sampleLights();

    if (millis() - start > CLIENT_TIMEOUT_MS) {
      break;
    }

    if (!client.available()) {
      continue;
    }

    char c = client.read();

    if (c == '\n' && currentLineIsBlank) {
      sendJson(client);
      break;
    }

    if (c == '\n') {
      currentLineIsBlank = true;
    } else if (c != '\r') {
      currentLineIsBlank = false;
    }
  }

  delay(1);
  client.stop();
}

void sendJson(EthernetClient &client) {
  client.println(F("HTTP/1.1 200 OK"));
  client.println(F("Content-Type: application/json"));
  client.println(F("Connection: close"));
  client.println(F("Cache-Control: no-store"));
  client.println();

  client.print(F("{\"green\":"));
  client.print(isOn(green) ? F("true") : F("false"));

  client.print(F(",\"yellow\":"));
  client.print(isOn(yellow) ? F("true") : F("false"));

  client.print(F(",\"red\":"));
  client.print(isOn(red) ? F("true") : F("false"));

  client.print(F(",\"greenStarts\":"));
  client.print(greenStarts);

  client.print(F(",\"greenMs\":"));
  client.print(greenMs);

  client.print(F(",\"uptimeMs\":"));
  client.print(millis());

  client.print(F("}"));
}
