import { isUri } from "valid-url";

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

    if (isUri(result)) {
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

  static getRequiredJsonEnvVar(key: string) {
    const jsonString = Env.getRequiredStringEnvVarOrThrow(key);

    try {
      return JSON.parse(jsonString);
    } catch (error) {
      throw `environment variable ${key} is not valid JSON`;
    }
  }

  static getOptionalJsonEnvVar(key: string) {
    const jsonString = Env.getOptionalEnvVar(key);

    if (jsonString) {
      try {
        return JSON.parse(jsonString);
      } catch (error) {
        throw `environment variable ${key} is not valid JSON`;
      }
    }

    return undefined;
  }

  static getRequiredBooleanEnvVar(key: string) {
    const string = Env.getRequiredStringEnvVarOrThrow(key);

    if (string.toLowerCase() === "true") {
      return true;
    } else if (string.toLowerCase() === "false") {
      return false;
    } else {
      throw `environment variable ${key} is not a valid boolean. expected 'true' or 'false'`;
    }
  }
}
