import _ from "lodash";
import { combineLatest, of } from "rxjs";
import { map } from "rxjs/operators";
import { config } from "../config.js";
import { notifyApprise } from "./apprise-notifier.js";
import { notifyConsole } from "./console-notifier.js";
import { notifyDesktop } from "./desktop-notifier.js";
import { notifyMqtt } from "./homeassistant-mqtt.js";
import { hasActiveTelegramChats$ } from "./telegram-bot.js";

const cache = { businessesById: {} };

export function hasListeners$() {
  return combineLatest([
    of(config.get("notifications.console.enabled")),
    of(config.get("notifications.desktop.enabled")),
    of(config.get("notifications.ifttt.enabled")),
    of(config.get("notifications.gotify.enabled")),
    of(config.get("notifications.mqtt.enabled")),
    hasActiveTelegramChats$(),
  ]).pipe(map((enabledItems) => _.some(enabledItems)));
}

export async function notifyIfChanged(businesses) {
  const businessesById = _.keyBy(businesses, "item.item_id");
  const messageByFormats = renderMessageByFormats(businesses);

  if (config.get("notifications.mqtt.enabled")) {
    notifyMqtt(messageByFormats.object);
  }

  const filteredBusinesses = filterBusinesses(businessesById);
  const filteredMessageByFormats = renderMessageByFormats(filteredBusinesses);

  if (config.get("notifications.console.enabled")) {
    notifyConsole(filteredMessageByFormats.text);
  }

  if (filteredBusinesses.length > 0) {
    if (config.get("notifications.desktop.enabled")) {
      notifyDesktop(filteredMessageByFormats.text);
    }
    if (config.get("notifications.telegram.enabled")) {
      notifyTelegram(filteredMessageByFormats.html);
    }
    if (config.get("notifications.apprise.enabled")) {
      await notifyApprise(filteredMessageByFormats);
    }
  }

  cache.businessesById = businessesById;
}

function filterBusinesses(businessesById) {
  return Object.keys(businessesById)
    .filter((key) => {
      const current = businessesById[key];
      const previous = cache.businessesById[key];
      return hasInterestingChange(current, previous);
    })
    .map((key) => businessesById[key]);
}

function hasInterestingChange(current, previous) {
  const options = config.get("messageFilter");

  const currentStock = current.items_available;
  const previousStock = previous ? previous.items_available : 0;

  const currentPrice = current.item.price_including_taxes.minor_units;
  const previousPrice = previous?.item.price_including_taxes.minor_units ?? currentPrice;

  if (currentPrice !== previousPrice && options.showPriceChange && currentStock) {
    return true
  }

  if (currentStock === previousStock) {
    return options.showUnchanged;
  } else if (currentStock === 0) {
    return options.showDecreaseToZero;
  } else if (currentStock < previousStock) {
    return options.showDecrease;
  } else if (previousStock === 0) {
    return options.showIncreaseFromZero;
  } else {
    return options.showIncrease;
  }
}
