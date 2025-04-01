var validUrl = require("valid-url");

export class Env {
  static getRequiredStringEnvVarOrThrow(key: string) {
    const result = process.env[key] as string;

    if (result) {
      return result;
    } else {
      throw `required environment variable is not defined: ${key}`;
    }
  }

  static getOptionalEnvVar(key: string): string | undefined {
    return process.env[key];
  }

  static getRequiredNumberEnvVarOrThrow(key: string) {
    const result = process.env[key];

    if (result) {
      if (isNaN(Number(result))) {
        throw `required numeric environment variable is not a number: ${key}`;
      } else {
        return Number(result);
      }
    } else {
      throw `required environment variable is not defined: ${key}`;
    }
  }

  static getRequiredUriEnvVarOrThrow(key: string) {
    const result = Env.getRequiredStringEnvVarOrThrow(key);

    if (validUrl.isUri(result)) {
      return result;
    } else {
      throw `environment variable ${key} is not a valid URI. please enter a valid URI (eg. https://ozone.example.com)`;
    }
  }

  static getRequiredCommaSeparatedEnvVarOrThrow(key: string) {
    const commaSeparatedString = Env.getRequiredStringEnvVarOrThrow(key);

    if (commaSeparatedString) {
      return commaSeparatedString.split(",");
    } else {
      return [];
    }
  }

  static getOptionalCommaSeparatedEnvVar(key: string) {
    const commaSeparatedString = Env.getOptionalEnvVar(key);

    if (commaSeparatedString) {
      return commaSeparatedString.split(",");
    } else {
      return [];
    }
  }
}
