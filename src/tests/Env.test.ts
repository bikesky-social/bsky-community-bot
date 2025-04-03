import { expect, test, describe, beforeAll } from "bun:test";
import { Env } from "../Env";

describe("Env", () => {
  beforeAll(() => {
    process.env.DOES_EXIST = "i actually do exist";
    process.env.NUMERIC = "10";
    process.env.NOT_NUMERIC = "i am not a number";
    process.env.VALID_URI = "https://ozone.example.com";
    process.env.INVALID_URI = "ozone@example.com";
    process.env.CSV = "label1,label2,label3";
    process.env.JSON = '{"health":"ok"}';
    process.env.INVALID_JSON = "i am not valid json";
    process.env.BOOLEAN_TRUE = "true";
    process.env.BOOLEAN_FALSE = "false";
    process.env.BOOLEAN_INVALID = "i am not a valid boolean";
  });

  test("getRequiredStringEnvVarOrThrow throws if variable does not exist", () => {
    expect(() => {
      Env.getRequiredStringEnvVarOrThrow("DOES_NOT_EXIST");
    }).toThrow("required environment variable is not defined: DOES_NOT_EXIST");
  });

  test("getRequiredStringEnvVarOrThrow returns the value for a variable that exists", () => {
    expect(Env.getRequiredStringEnvVarOrThrow("DOES_EXIST")).toBe(
      "i actually do exist"
    );
  });

  test("getOptionalEnvVar returns an environment variable's value if it exists", () => {
    expect(Env.getOptionalEnvVar("DOES_EXIST")).toBe("i actually do exist");
  });

  test("getOptionalEnvVar returns undefined if an environment variable does not exist", () => {
    expect(Env.getOptionalEnvVar("DOES_NOT_EXIST")).toBeUndefined();
  });

  test("getRequiredNumberEnvVarOrThrow throws if variable does not exist", () => {
    expect(() => {
      Env.getRequiredNumberEnvVarOrThrow("DOES_NOT_EXIST");
    }).toThrow("required environment variable is not defined: DOES_NOT_EXIST");
  });

  test("getRequiredNumberEnvVarOrThrow returns the value for a variable that exists", () => {
    expect(Env.getRequiredNumberEnvVarOrThrow("NUMERIC")).toBe(10);
  });

  test("getRequiredNumberEnvVarOrThrow throws if the variable is not a number", () => {
    expect(() => {
      Env.getRequiredNumberEnvVarOrThrow("NOT_NUMERIC");
    }).toThrow(
      "required numeric environment variable is not a number: NOT_NUMERIC"
    );
  });

  test("getRequiredUriEnvVarOrThrow returns the value for a variable that exists", () => {
    expect(Env.getRequiredUriEnvVarOrThrow("VALID_URI")).toBe(
      "https://ozone.example.com"
    );
  });

  test("getRequiredUriEnvVarOrThrow throws if the variable is not a valid URI", () => {
    expect(() => {
      Env.getRequiredUriEnvVarOrThrow("INVALID_URI");
    }).toThrow(
      "environment variable INVALID_URI is not a valid URI. please enter a valid URI (eg. https://ozone.example.com)"
    );
  });

  test("getRequiredCommaSeparatedEnvVarOrThrow returns an array of values for a variable that exists", () => {
    const result = Env.getRequiredCommaSeparatedEnvVarOrThrow("CSV");
    expect(result).toBeArray();
    expect(result).toContainValues(["label1", "label2", "label3"]);
  });

  test("getRequiredCommaSeparatedEnvVarOrThrow throws if the variable does not exist", () => {
    expect(() => {
      Env.getRequiredCommaSeparatedEnvVarOrThrow("DOES_NOT_EXIST");
    }).toThrow("required environment variable is not defined: DOES_NOT_EXIST");
  });

  test("getOptionalCommaSeparatedEnvVar returns an array of values if it exists", () => {
    const result = Env.getOptionalCommaSeparatedEnvVar("CSV");
    expect(result).toBeArray();
    expect(result).toContainValues(["label1", "label2", "label3"]);
  });

  test("getOptionalCommaSeparatedEnvVar returns an empty array if an environment variable does not exist", () => {
    expect(
      Env.getOptionalCommaSeparatedEnvVar("DOES_NOT_EXIST")
    ).toBeArrayOfSize(0);
  });

  test("getOptionalJsonEnvVar returns an object if the variable exists", () => {
    const result = Env.getOptionalJsonEnvVar("JSON");
    expect(result).toBeObject();
    expect(result).toContainKey("health");
  });

  test("getOptionalJsonEnvVar throws if the variable is not valid json", () => {
    expect(() => {
      Env.getOptionalJsonEnvVar("INVALID_JSON");
    }).toThrow("environment variable INVALID_JSON is not valid JSON");
  });

  test("getOptionalJsonEnvVar returns undefined if the variable does not exist", () => {
    expect(Env.getOptionalJsonEnvVar("DOES_NOT_EXIST")).toBeUndefined();
  });

  test("getRequiredJsonEnvVar throws if the variable does not exist", () => {
    expect(() => {
      Env.getRequiredJsonEnvVar("DOES_NOT_EXIST");
    }).toThrow("required environment variable is not defined: DOES_NOT_EXIST");
  });

  test("getRequiredJsonEnvVar throws if the variable is not valid json", () => {
    expect(() => {
      Env.getRequiredJsonEnvVar("INVALID_JSON");
    }).toThrow("environment variable INVALID_JSON is not valid JSON");
  });

  test("getRequiredJsonEnvVar returns an object if the variable exists", () => {
    const result = Env.getRequiredJsonEnvVar("JSON");
    expect(result).toBeObject();
    expect(result).toContainKey("health");
  });

  test("getRequiredBooleanEnvVar returns true for an env var that is set to true", () => {
    expect(Env.getRequiredBooleanEnvVar("BOOLEAN_TRUE")).toBe(true);
  });

  test("getRequiredBooleanEnvVar returns false for an env var that is set to false", () => {
    expect(Env.getRequiredBooleanEnvVar("BOOLEAN_FALSE")).toBe(false);
  });

  test("getRequiredBooleanEnvVar throws for an env var that is not a valid boolean", () => {
    expect(() => {
      Env.getRequiredBooleanEnvVar("BOOLEAN_INVALID");
    }).toThrow(
      "environment variable BOOLEAN_INVALID is not a valid boolean. expected 'true' or 'false'"
    );
  });

  test("getRequiredBooleanEnvVar to throw if the env var does not exist", () => {
    expect(() => {
      Env.getRequiredBooleanEnvVar("DOES_NOT_EXIST");
    }).toThrow("required environment variable is not defined: DOES_NOT_EXIST");
  });
});
