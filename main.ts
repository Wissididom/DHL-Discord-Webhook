async function fileExists(path: string) {
  try {
    await Deno.lstat(path);
    return true;
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      return false;
    } else {
      throw err;
    }
  }
}

const WEBHOOK_USERNAME: string = "DHL";
const WEBHOOK_AVATAR_URL: string =
  "https://www.dhl.de/.resources/dhl/webresources/assets/icons/favicons/apple-touch-icon.png";
const CONTENT_FORMAT_STRING: string =
  "New Status (Updated: <t:{0}:F>):\nName: ``{1}`` (``{2}``)\nMessage: ``{3}``\nLink: <{4}>";

if (
  !Deno.env.has("DISCORD_WEBHOOK_URL") || !Deno.env.has("DHL_TRACKING_CODE") ||
  !Deno.env.has("DHL_LANGUAGE")
) {
  console.log(
    "Please specify DISCORD_WEBHOOK_URL, DHL_TRACKING_CODE and DHL_LANGUAGE env variables!",
  );
  Deno.exit(1);
}

const dhlResponse = await fetch(
  `https://www.dhl.de/int-verfolgen/data/search?piececode=${
    Deno.env.get("DHL_TRACKING_CODE")
  }&language=${Deno.env.get("DHL_LANGUAGE")}`,
).then((res) => res.json());

if (
  !dhlResponse ||
  !dhlResponse.sendungen[0].sendungsdetails.sendungsverlauf.datumAktuellerStatus
) {
  Deno.exit();
}

const updated: Date = new Date(
  dhlResponse.sendungen[0].sendungsdetails.sendungsverlauf.datumAktuellerStatus,
);

if (!updated) {
  Deno.exit();
}

const timestamp: number = Math.floor(updated.getTime()) / 1000;

let fileNeedsUpdate = true;

if (await fileExists("lastUpdatedValue")) {
  const lastUpdatedValue: string = await Deno.readTextFile("lastUpdatedValue");
  if (lastUpdatedValue.trim() == updated.toISOString()) {
    console.log("Already latest version");
    fileNeedsUpdate = false;
  } else {
    console.log("Needs update");
    const name: string = dhlResponse.sendungen[0].sendungsinfo.sendungsname ??
      "N/A";
    const trackingCode: string =
      dhlResponse.sendungen[0].sendungsinfo.gesuchteSendungsnummer;
    const message: string =
      dhlResponse.sendungen[0].sendungsdetails.sendungsverlauf.aktuellerStatus;
    const link: string =
      `https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${
        Deno.env.get("DHL_TRACKING_CODE")
      }`;
    const content: string = CONTENT_FORMAT_STRING.replace(
      "{0}",
      timestamp.toString(),
    ).replace("{1}", name).replace("{2}", trackingCode).replace("{3}", message)
      .replace("{4}", link);
    const response = await fetch(
      `${Deno.env.get("DISCORD_WEBHOOK_URL")}?wait=true`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: WEBHOOK_USERNAME,
          avatar_url: WEBHOOK_AVATAR_URL,
          allowed_mentions: {
            parse: [],
          },
          content,
        }),
      },
    );
    console.log(response.status);
  }
} else {
  console.log("File does not exist");
}
if (fileNeedsUpdate) {
  await Deno.writeTextFile("lastUpdatedValue", updated.toISOString());
}
