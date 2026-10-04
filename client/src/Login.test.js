import { render, screen, fireEvent } from "@testing-library/react";
import { act } from "react-dom/test-utils";
import userEvent from "@testing-library/user-event";

jest.mock("./api", () => ({
    authApi: {
        login: jest.fn(),
        register: jest.fn(),
        sendFeedback: jest.fn(),
    },
}));

// eslint-disable-next-line import/first
import Login from "./Login";

const go = (search) => {
    window.history.pushState({}, "", `/login${search}`);
    render(<Login />);
};

const errorCount = () => document.querySelectorAll(".error").length;
const invalidCount = () => document.querySelectorAll("input.invalid").length;
const byPlaceholder = (text) => screen.queryByPlaceholderText(text);
const byButton = (name) => screen.getByRole("button", { name });

const click = async (el) => {
    await act(async () => {
        userEvent.click(el);
    });
};

const typeInto = async (el, text) => {
    await act(async () => {
        userEvent.type(el, text);
    });
};

const blur = async (el) => {
    await act(async () => {
        fireEvent.blur(el);
    });
};

const changeDate = async (el, value) => {
    await act(async () => {
        fireEvent.change(el, { target: { value } });
    });
};

describe("Login form validation", () => {
    test("register page shows no errors on pristine inputs", async () => {
        go("?type=register");
        expect(errorCount()).toBe(0);
        expect(invalidCount()).toBe(0);
    });

    test("Next on empty register page shows errors and does not advance", async () => {
        go("?type=register");
        await click(byButton("Next"));
        expect(errorCount()).toBeGreaterThan(0);
        expect(byPlaceholder("First Name")).not.toBeNull();
    });

    test("valid register page advances without errors", async () => {
        go("?type=register");
        await typeInto(byPlaceholder("First Name"), "John");
        await typeInto(byPlaceholder("Last Name (Optional)"), "Doe");
        await changeDate(document.getElementById("DOB"), "2000-01-01");
        expect(errorCount()).toBe(0);
        await click(byButton("Next"));
        expect(byPlaceholder("Username")).not.toBeNull();
    });

    test("blur on invalid input shows its error", async () => {
        go("?type=register");
        const input = byPlaceholder("First Name");
        await typeInto(input, "!!!");
        await blur(input);
        expect(errorCount()).toBeGreaterThan(0);
    });

    test("login page shows no errors pristine, blocks empty submit", async () => {
        go("");
        expect(errorCount()).toBe(0);
        await click(byButton("Submit"));
        expect(errorCount()).toBeGreaterThan(0);
        expect(byPlaceholder("Username")).not.toBeNull();
    });

    test("feedback page validates on submit", async () => {
        go("?type=feedback");
        expect(errorCount()).toBe(0);
        await click(byButton("Submit"));
        expect(errorCount()).toBeGreaterThan(0);
    });
});
