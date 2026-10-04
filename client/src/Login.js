import React, { useEffect, useState } from "react";
import "./Login.css";
import { authApi } from "./api";
import CryptoJS from "crypto-js";
import Cookies from "js-cookie";

const USERNAME_REGEX = /^[a-zA-Z][a-zA-Z0-9-_]{3,23}$/;
const PASSWORD_REGEX =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%])[a-zA-Z0-9!@#$%]{8,24}$/;
const EMAIL_REGEX = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
const ALPHANUMERIC_REGEX = /^[a-zA-Z0-9]+$/;
const CHANNEL_ID_REGEX = /^UC[a-zA-Z0-9-_]{22}$/;

function Login(params) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showCPassword, setShowCPassword] = useState(false);
    const [username, setUsername] = useState("");
    const [firstname, setfirstname] = useState("");
    const [lastname, setlastname] = useState("");
    const [DOB, setDOB] = useState("");
    const [confirm_password, setConfirmpassword] = useState("");
    const [channel_name, setChannel_name] = useState("");
    const [location, setLocation] = useState("");
    const [channel_desc, setChannel_desc] = useState("");
    const [feedback, setFeedback] = useState("");
    const [reqchannelid, setReqchannelid] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [touched, setTouched] = useState({});
    const [loginIdType, setLoginIdType] = useState("username");
    const [ishandlesubmit, setIshandlesubmit] = useState(false);
    const queryParams = new URLSearchParams(window.location.search);
    const type = queryParams.get("type");
    const serverurl = process.env.REACT_APP_SERVER_URL;

    const [i, seti] = useState(
        type === "register" ? 0 : type === "feedback" ? 10 : 8
    );

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    const toggleCPasswordVisibility = () => {
        setShowCPassword(!showCPassword);
    };

    useEffect(() => {
        if (type === "logout") {
            const LogOut = () => {
                Cookies.remove("user");
                window.location.href = "/";
            };
            LogOut();
        }
    }, [type]);

    function sanitizeForSQL(input) {
        return input.replace(/'/g, "''");
    }

    function replaceCharacters(inputString) {
        const replacements = {
            a: "c",
            d: "b",
            " ": "z",
            e: "f",
            f: "g",
            g: "h",
        };

        let modifiedString = "";
        for (let char of inputString) {
            if (replacements[char]) {
                modifiedString += replacements[char];
            } else {
                modifiedString += char;
            }
        }

        return modifiedString;
    }

    function stringToHash(inputString) {
        const sha256Hash = CryptoJS.SHA256(replaceCharacters(inputString));
        const base64Hash = CryptoJS.enc.Base64.stringify(sha256Hash);
        const urlSafeBase64Hash = base64Hash
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

        if (urlSafeBase64Hash.length >= 24) {
            return urlSafeBase64Hash.slice(0, 24);
        } else {
            return urlSafeBase64Hash.padEnd(24, "0");
        }
    }

    const setCookie = (user) => {
        Cookies.set("user", JSON.stringify(user), { expires: 30 });
        localStorage.setItem("iswatchlater", "true");
        localStorage.setItem("ishistory", "true");
        localStorage.setItem("islikedvideos", "true");
        localStorage.setItem("isShorts", "true");
    };

    const handleSubmit = async (e, type) => {
        if (ishandlesubmit) {
            return;
        }
        setIshandlesubmit(true);
        const hashpass = stringToHash(password);
        try {
            if (type === "login") {
                const response = await authApi.login(username, email, hashpass);
                setCookie(response.user);
                return { success: true };
            }

            if (type === "register") {
                const requestData = {
                    email,
                    username,
                    hashpass,
                    fnamefix: sanitizeForSQL(firstname),
                    lnamefix: sanitizeForSQL(lastname),
                    chl_namefix: sanitizeForSQL(channel_name),
                    chl_descfix: sanitizeForSQL(channel_desc),
                    DOB,
                    location,
                };
                await authApi.register(requestData);
                return { success: true };
            }

            if (type === "feedback") {
                const requestData = {
                    name: firstname + " " + lastname,
                    feedback: sanitizeForSQL(feedback),
                    reqchannelid,
                };
                await authApi.sendFeedback(requestData.feedback, requestData.reqchannelid, requestData.name);
                return { success: true };
            }
        } catch (error) {
            console.error("Error:", error);
            return {
                success: false,
                message: error.message || "An error occurred",
            };
        }
        setIshandlesubmit(false);
    };

    const validUsername = USERNAME_REGEX.test(username);
    const usernameError = validUsername
        ? ""
        : "Username must contain alteast 4 letters.";
    const validFirstname =
        ALPHANUMERIC_REGEX.test(firstname) && firstname !== "";
    const firstnameError = validFirstname
        ? ""
        : "First name must contain only alphanumeric characters.";
    const validLastname =
        ALPHANUMERIC_REGEX.test(lastname) || lastname === "";
    const lastnameError = validLastname
        ? ""
        : "Last name must contain only alphanumeric characters.";
    const validMatch = password === confirm_password;
    const matchError = validMatch ? "" : "Passwords do not match.";
    const validEmail = EMAIL_REGEX.test(email);
    const emailError = validEmail ? "" : "Invalid email format.";
    const validPassword = PASSWORD_REGEX.test(password);
    const passwordError = validPassword
        ? ""
        : "Password must contain atleast one of each uppercase, lowercase, number and special character.";
    const validChannel =
        ALPHANUMERIC_REGEX.test(channel_name) && channel_name !== "";
    const channelError = validChannel
        ? ""
        : "Channel name must contain only alphanumeric characters.";
    const validLocation = location !== "";
    const locationError = validLocation ? "" : "Location is required.";
    const validDOB = DOB !== "";
    const DOBError = validDOB ? "" : "Date of birth is required.";
    const validChannelid =
        CHANNEL_ID_REGEX.test(reqchannelid) || reqchannelid === "";
    const channelidError = validChannelid
        ? ""
        : "Invalid Channel id. You can find it at Navigate to youtube channel > click on more details > share channel > copy channel id";
    const allValid4reg =
        validEmail &&
        validUsername &&
        validPassword &&
        validMatch &&
        validFirstname &&
        validLastname &&
        validDOB &&
        validChannel &&
        validLocation;

    const touch = (...fields) => {
        setTouched((prev) => {
            const next = { ...prev };
            fields.forEach((field) => {
                next[field] = true;
            });
            return next;
        });
    };

    const showErr = (field, message) =>
        touched[field] && message ? <p className="error">{message}</p> : null;

    const fieldClass = (field, valid) =>
        !touched[field] ? "" : valid ? "valid" : "invalid";

    const fieldAriaInvalid = (field, valid) =>
        touched[field] && !valid ? "true" : "false";

    const goNext = (e, fields, ok, next) => {
        e.preventDefault();
        touch(...fields);
        if (ok) {
            seti(next);
        }
    };

    return (
        <div className="login-box">
            <div className="form-box">
                <div className="form-box-left">
                    <img
                        className="form-box-logo"
                        alt="formbox"
                        src="https://cdn-icons-png.flaticon.com/128/1384/1384060.png"
                    />
                    <p className="box-head">
                        {i >= 8 && i < 10
                            ? "Sign in"
                            : i < 8
                            ? "Create a VidVault Account"
                            : i >= 10
                            ? "Give your Precious Feedback"
                            : ""}
                    </p>
                    <p className="box-desc">
                        {i === 0
                            ? "About you"
                            : i === 1
                            ? "Account details"
                            : i === 2 || i === 3
                            ? "Your channel"
                            : i === 8
                            ? "Enter your details"
                            : i === 10
                            ? "Give your Feedback"
                            : ""}
                    </p>
                </div>

                {i === 0 ? (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                        }}
                    >
                        <div className="inputdata">
                            <input
                                className={fieldClass("firstname", validFirstname)}
                                type="text"
                                value={firstname}
                                id="firstname"
                                onChange={(e) => setfirstname(e.target.value)}
                                onBlur={() => touch("firstname")}
                                placeholder="First Name"
                                autoComplete="off"
                                aria-invalid={fieldAriaInvalid("firstname", validFirstname)}
                                required
                                autoFocus
                            />
                            {showErr("firstname", firstnameError)}

                            <br></br>

                            <input
                                className={fieldClass("lastname", validLastname)}
                                type="text"
                                value={lastname}
                                id="lastname"
                                autoComplete="off"
                                onChange={(e) => setlastname(e.target.value)}
                                onBlur={() => touch("lastname")}
                                placeholder="Last Name (Optional)"
                                aria-invalid={fieldAriaInvalid("lastname", validLastname)}
                            />
                            {showErr("lastname", lastnameError)}
                            <br></br>
                            <input
                                className={fieldClass("DOB", validDOB)}
                                type="date"
                                value={DOB}
                                id="DOB"
                                autoComplete="off"
                                onChange={(e) => setDOB(e.target.value)}
                                onBlur={() => touch("DOB")}
                                aria-invalid={fieldAriaInvalid("DOB", validDOB)}
                                required
                            />
                            {showErr("DOB", DOBError)}
                            <br></br>
                            <span
                                className="login-ques"
                                onClick={(e) => {
                                    e.preventDefault();
                                    seti(8);
                                }}
                            >
                                Already Registered? Login here
                            </span>
                            <br></br>
                            <button
                                className="next-btn"
                                onClick={(e) => {
                                    goNext(
                                        e,
                                        ["firstname", "lastname", "DOB"],
                                        validFirstname && validLastname && validDOB,
                                        1
                                    );
                                }}
                            >
                                Next
                            </button>
                        </div>
                    </form>
                ) : i === 1 ? (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                        }}
                    >
                        <div className="inputdata">
                            <input
                                className={fieldClass("username", validUsername)}
                                type="text"
                                value={username}
                                id="username"
                                onChange={(e) => setUsername(e.target.value)}
                                onBlur={() => touch("username")}
                                placeholder="Username"
                                autoComplete="off"
                                aria-invalid={fieldAriaInvalid("username", validUsername)}
                                required
                                autoFocus
                            />
                            {showErr("username", usernameError)}
                            <br></br>
                            <input
                                className={fieldClass("email", validEmail)}
                                type="email"
                                value={email}
                                id="email"
                                onChange={(e) => setEmail(e.target.value)}
                                onBlur={() => touch("email")}
                                placeholder="Email"
                                autoComplete="off"
                                aria-invalid={fieldAriaInvalid("email", validEmail)}
                                required
                            />
                            {showErr("email", emailError)}
                            <br></br>
                            <div className="pass-eye-box">
                                <input
                                    className={fieldClass("password", validPassword)}
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    id="password"
                                    autoComplete="off"
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    onBlur={() => touch("password")}
                                    placeholder="Password"
                                    aria-invalid={fieldAriaInvalid("password", validPassword)}
                                    required
                                />
                                {showPassword ? (
                                    <img
                                        className="pass-eye"
                                        src="https://cdn-icons-png.flaticon.com/128/709/709612.png"
                                        alt="show pass"
                                        title="Show Password"
                                        onClick={togglePasswordVisibility}
                                    />
                                ) : (
                                    <img
                                        className="pass-eye"
                                        src="https://cdn-icons-png.flaticon.com/128/2767/2767146.png"
                                        alt="hide pass"
                                        title="Hide Password"
                                        onClick={togglePasswordVisibility}
                                    />
                                )}
                            </div>

                            {showErr("password", passwordError)}
                            <br></br>
                            <div className="pass-eye-box">
                                <input
                                    className={fieldClass("confirm_password", validMatch)}
                                    type={showCPassword ? "text" : "password"}
                                    value={confirm_password}
                                    id="confirm_password"
                                    autoComplete="off"
                                    onChange={(e) =>
                                        setConfirmpassword(e.target.value)
                                    }
                                    onBlur={() => touch("confirm_password")}
                                    aria-invalid={fieldAriaInvalid("confirm_password", validMatch)}
                                    placeholder="Confirm Password"
                                    required
                                />
                                {showCPassword ? (
                                    <img
                                        className="pass-eye"
                                        src="https://cdn-icons-png.flaticon.com/128/709/709612.png"
                                        alt="show pass"
                                        title="Show Password"
                                        onClick={toggleCPasswordVisibility}
                                    />
                                ) : (
                                    <img
                                        className="pass-eye"
                                        src="https://cdn-icons-png.flaticon.com/128/2767/2767146.png"
                                        alt="hide pass"
                                        title="Hide Password"
                                        onClick={toggleCPasswordVisibility}
                                    />
                                )}
                            </div>

                            {showErr("confirm_password", matchError)}
                            <br></br>
                            <button
                                className="next-btn back-btn"
                                onClick={(e) => {
                                    e.preventDefault();
                                    seti(0);
                                }}
                            >
                                Back
                            </button>
                            <button
                                className="next-btn"
                                onClick={(e) => {
                                    goNext(
                                        e,
                                        ["username", "email", "password", "confirm_password"],
                                        validUsername &&
                                            validEmail &&
                                            validPassword &&
                                            validMatch,
                                        2
                                    );
                                }}
                            >
                                Next
                            </button>
                        </div>
                    </form>
                ) : i === 2 ? (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                        }}
                    >
                        <div className="inputdata">
                            <input
                                className={fieldClass("channel_name", validChannel)}
                                type="text"
                                value={channel_name}
                                id="channel_name"
                                autoComplete="off"
                                onChange={(e) =>
                                    setChannel_name(e.target.value)
                                }
                                onBlur={() => touch("channel_name")}
                                placeholder="Channel Name"
                                aria-invalid={fieldAriaInvalid("channel_name", validChannel)}
                                required
                                autoFocus
                            />
                            {showErr("channel_name", channelError)}
                            <br></br>
                            <input
                                type="text"
                                value={channel_desc}
                                id="channel_desc"
                                autoComplete="off"
                                onChange={(e) =>
                                    setChannel_desc(e.target.value)
                                }
                                placeholder="Channel Description (Optional)"
                            />
                            <br></br>
                            <button
                                className="next-btn back-btn"
                                onClick={(e) => {
                                    e.preventDefault();
                                    seti(1);
                                }}
                            >
                                Back
                            </button>
                            <button
                                className="next-btn"
                                onClick={(e) => {
                                    goNext(
                                        e,
                                        ["channel_name"],
                                        validChannel,
                                        3
                                    );
                                }}
                            >
                                Next
                            </button>
                        </div>
                    </form>
                ) : i === 3 ? (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                        }}
                    >
                        <div className="inputdata">
                            <select
                                className={fieldClass("location", validLocation)}
                                id="country"
                                name="country"
                                onChange={(e) => setLocation(e.target.value)}
                                onBlur={() => touch("location")}
                                aria-invalid={fieldAriaInvalid("location", validLocation)}
                                aria-placeholder="Select your location"
                            >
                                <option value="">Select your country</option>
                                <option value="AF">Afghanistan</option>
                                <option value="AL">Albania</option>
                                <option value="DZ">Algeria</option>
                                <option value="AS">American Samoa</option>
                                <option value="AD">Andorra</option>
                                <option value="AO">Angola</option>
                                <option value="AI">Anguilla</option>
                                <option value="AQ">Antarctica</option>
                                <option value="AG">Antigua and Barbuda</option>
                                <option value="AR">Argentina</option>
                                <option value="AM">Armenia</option>
                                <option value="AW">Aruba</option>
                                <option value="AU">Australia</option>
                                <option value="AT">Austria</option>
                                <option value="AZ">Azerbaijan</option>
                                <option value="BS">Bahamas</option>
                                <option value="BH">Bahrain</option>
                                <option value="BD">Bangladesh</option>
                                <option value="BB">Barbados</option>
                                <option value="BY">Belarus</option>
                                <option value="BE">Belgium</option>
                                <option value="BZ">Belize</option>
                                <option value="BJ">Benin</option>
                                <option value="BM">Bermuda</option>
                                <option value="BT">Bhutan</option>
                                <option value="BO">Bolivia</option>
                                <option value="BA">
                                    Bosnia and Herzegovina
                                </option>
                                <option value="BW">Botswana</option>
                                <option value="BR">Brazil</option>
                                <option value="IO">
                                    British Indian Ocean Territory
                                </option>
                                <option value="BN">Brunei Darussalam</option>
                                <option value="BG">Bulgaria</option>
                                <option value="BF">Burkina Faso</option>
                                <option value="BI">Burundi</option>
                                <option value="KH">Cambodia</option>
                                <option value="CM">Cameroon</option>
                                <option value="CA">Canada</option>
                                <option value="CV">Cape Verde</option>
                                <option value="KY">Cayman Islands</option>
                                <option value="CF">
                                    Central African Republic
                                </option>
                                <option value="TD">Chad</option>
                                <option value="CL">Chile</option>
                                <option value="CN">China</option>
                                <option value="CO">Colombia</option>
                                <option value="KM">Comoros</option>
                                <option value="CG">Congo</option>
                                <option value="CD">
                                    Congo, the Democratic Republic of the
                                </option>
                                <option value="CK">Cook Islands</option>
                                <option value="CR">Costa Rica</option>
                                <option value="CI">Cote D'Ivoire</option>
                                <option value="HR">Croatia</option>
                                <option value="CU">Cuba</option>
                                <option value="CY">Cyprus</option>
                                <option value="CZ">Czech Republic</option>
                                <option value="DK">Denmark</option>
                                <option value="DJ">Djibouti</option>
                                <option value="DM">Dominica</option>
                                <option value="DO">Dominican Republic</option>
                                <option value="EC">Ecuador</option>
                                <option value="EG">Egypt</option>
                                <option value="SV">El Salvador</option>
                                <option value="GQ">Equatorial Guinea</option>
                                <option value="ER">Eritrea</option>
                                <option value="EE">Estonia</option>
                                <option value="ET">Ethiopia</option>
                                <option value="FK">
                                    Falkland Islands (Malvinas)
                                </option>
                                <option value="FO">Faroe Islands</option>
                                <option value="FJ">Fiji</option>
                                <option value="FI">Finland</option>
                                <option value="FR">France</option>
                                <option value="GF">French Guiana</option>
                                <option value="PF">French Polynesia</option>
                                <option value="TF">
                                    French Southern Territories
                                </option>
                                <option value="GA">Gabon</option>
                                <option value="GM">Gambia</option>
                                <option value="GE">Georgia</option>
                                <option value="DE">Germany</option>
                                <option value="GH">Ghana</option>
                                <option value="GI">Gibraltar</option>
                                <option value="GR">Greece</option>
                                <option value="GL">Greenland</option>
                                <option value="GD">Grenada</option>
                                <option value="GP">Guadeloupe</option>
                                <option value="GU">Guam</option>
                                <option value="GT">Guatemala</option>
                                <option value="GN">Guinea</option>
                                <option value="GW">Guinea-Bissau</option>
                                <option value="GY">Guyana</option>
                                <option value="HT">Haiti</option>
                                <option value="VA">
                                    Holy See (Vatican City State)
                                </option>
                                <option value="HN">Honduras</option>
                                <option value="HK">Hong Kong</option>
                                <option value="HU">Hungary</option>
                                <option value="IS">Iceland</option>
                                <option value="IN">India</option>
                                <option value="ID">Indonesia</option>
                                <option value="IR">
                                    Iran, Islamic Republic of
                                </option>
                                <option value="IQ">Iraq</option>
                                <option value="IE">Ireland</option>
                                <option value="IL">Israel</option>
                                <option value="IT">Italy</option>
                                <option value="JM">Jamaica</option>
                                <option value="JP">Japan</option>
                                <option value="JO">Jordan</option>
                                <option value="KZ">Kazakhstan</option>
                                <option value="KE">Kenya</option>
                                <option value="KI">Kiribati</option>
                                <option value="KP">
                                    Korea, Democratic People's Republic of
                                </option>
                                <option value="KR">Korea, Republic of</option>
                                <option value="KW">Kuwait</option>
                                <option value="KG">Kyrgyzstan</option>
                                <option value="LA">
                                    Lao People's Democratic Republic
                                </option>
                                <option value="LV">Latvia</option>
                                <option value="LB">Lebanon</option>
                                <option value="LS">Lesotho</option>
                                <option value="LR">Liberia</option>
                                <option value="LY">Libya</option>
                                <option value="LI">Liechtenstein</option>
                                <option value="LT">Lithuania</option>
                                <option value="LU">Luxembourg</option>
                                <option value="MO">Macao</option>
                                <option value="MK">
                                    Macedonia, the Former Yugoslav Republic of
                                </option>
                                <option value="MG">Madagascar</option>
                                <option value="MW">Malawi</option>
                                <option value="MY">Malaysia</option>
                                <option value="MV">Maldives</option>
                                <option value="ML">Mali</option>
                                <option value="MT">Malta</option>
                                <option value="MH">Marshall Islands</option>
                                <option value="MQ">Martinique</option>
                                <option value="MR">Mauritania</option>
                                <option value="MU">Mauritius</option>
                                <option value="YT">Mayotte</option>
                                <option value="MX">Mexico</option>
                                <option value="FM">
                                    Micronesia, Federated States of
                                </option>
                                <option value="MD">Moldova, Republic of</option>
                                <option value="MC">Monaco</option>
                                <option value="MN">Mongolia</option>
                                <option value="ME">Montenegro</option>
                                <option value="MS">Montserrat</option>
                                <option value="MA">Morocco</option>
                                <option value="MZ">Mozambique</option>
                                <option value="MM">Myanmar</option>
                                <option value="NA">Namibia</option>
                                <option value="NR">Nauru</option>
                                <option value="NP">Nepal</option>
                                <option value="NL">Netherlands</option>
                                <option value="NC">New Caledonia</option>
                                <option value="NZ">New Zealand</option>
                                <option value="NI">Nicaragua</option>
                                <option value="NE">Niger</option>
                                <option value="NG">Nigeria</option>
                                <option value="NU">Niue</option>
                                <option value="NF">Norfolk Island</option>
                                <option value="MP">
                                    Northern Mariana Islands
                                </option>
                                <option value="NO">Norway</option>
                                <option value="OM">Oman</option>
                                <option value="PK">Pakistan</option>
                                <option value="PW">Palau</option>
                                <option value="PS">Palestine, State of</option>
                                <option value="PA">Panama</option>
                                <option value="PG">Papua New Guinea</option>
                                <option value="PY">Paraguay</option>
                                <option value="PE">Peru</option>
                                <option value="PH">Philippines</option>
                                <option value="PN">Pitcairn</option>
                                <option value="PL">Poland</option>
                                <option value="PT">Portugal</option>
                                <option value="PR">Puerto Rico</option>
                                <option value="QA">Qatar</option>
                                <option value="RE">Reunion</option>
                                <option value="RO">Romania</option>
                                <option value="RU">Russian Federation</option>
                                <option value="RW">Rwanda</option>
                                <option value="BL">Saint Barthelemy</option>
                                <option value="SH">Saint Helena</option>
                                <option value="KN">
                                    Saint Kitts and Nevis
                                </option>
                                <option value="LC">Saint Lucia</option>
                                <option value="MF">
                                    Saint Martin (French part)
                                </option>
                                <option value="PM">
                                    Saint Pierre and Miquelon
                                </option>
                                <option value="VC">
                                    Saint Vincent and the Grenadines
                                </option>
                                <option value="WS">Samoa</option>
                                <option value="SM">San Marino</option>
                                <option value="ST">
                                    Sao Tome and Principe
                                </option>
                                <option value="SA">Saudi Arabia</option>
                                <option value="SN">Senegal</option>
                                <option value="RS">Serbia</option>
                                <option value="SC">Seychelles</option>
                                <option value="SL">Sierra Leone</option>
                                <option value="SG">Singapore</option>
                                <option value="SX">
                                    Sint Maarten (Dutch part)
                                </option>
                                <option value="SK">Slovakia</option>
                                <option value="SI">Slovenia</option>
                                <option value="SB">Solomon Islands</option>
                                <option value="SO">Somalia</option>
                                <option value="ZA">South Africa</option>
                                <option value="GS">
                                    South Georgia and the South Sandwich Islands
                                </option>
                                <option value="SS">South Sudan</option>
                                <option value="ES">Spain</option>
                                <option value="LK">Sri Lanka</option>
                                <option value="SD">Sudan</option>
                                <option value="SR">Suriname</option>
                                <option value="SJ">
                                    Svalbard and Jan Mayen
                                </option>
                                <option value="SZ">Swaziland</option>
                                <option value="SE">Sweden</option>
                                <option value="CH">Switzerland</option>
                                <option value="SY">Syrian Arab Republic</option>
                                <option value="TW">
                                    Taiwan, Province of China
                                </option>
                                <option value="TJ">Tajikistan</option>
                                <option value="TZ">
                                    Tanzania, United Republic of
                                </option>
                                <option value="TH">Thailand</option>
                                <option value="TL">Timor-Leste</option>
                                <option value="TG">Togo</option>
                                <option value="TK">Tokelau</option>
                                <option value="TO">Tonga</option>
                                <option value="TT">Trinidad and Tobago</option>
                                <option value="TN">Tunisia</option>
                                <option value="TR">Turkey</option>
                                <option value="TM">Turkmenistan</option>
                                <option value="TC">
                                    Turks and Caicos Islands
                                </option>
                                <option value="TV">Tuvalu</option>
                                <option value="UG">Uganda</option>
                                <option value="UA">Ukraine</option>
                                <option value="AE">United Arab Emirates</option>
                                <option value="GB">United Kingdom</option>
                                <option value="US">United States</option>
                                <option value="UM">
                                    United States Minor Outlying Islands
                                </option>
                                <option value="UY">Uruguay</option>
                                <option value="UZ">Uzbekistan</option>
                                <option value="VU">Vanuatu</option>
                                <option value="VE">Venezuela</option>
                                <option value="VN">Viet Nam</option>
                                <option value="VG">
                                    Virgin Islands, British
                                </option>
                                <option value="VI">Virgin Islands, U.S.</option>
                                <option value="WF">Wallis and Futuna</option>
                                <option value="EH">Western Sahara</option>
                                <option value="YE">Yemen</option>
                                <option value="ZM">Zambia</option>
                                <option value="ZW">Zimbabwe</option>
                            </select>
                            <br></br>
                            {showErr("location", locationError)}
                            <button
                                className="next-btn back-btn"
                                onClick={(e) => {
                                    e.preventDefault();
                                    seti(2);
                                }}
                            >
                                Back
                            </button>
                            <button
                                type="submit"
                                onClick={async (e) => {
                                    e.preventDefault();
                                    touch("location");
                                    if (allValid4reg) {
                                        const result = await handleSubmit(
                                            e,
                                            "register"
                                        );
                                        if (result.success) {
                                            window.location.href = "/login";
                                        } else {
                                            setErrorMessage(
                                                result.message ||
                                                    "Registration failed"
                                            );
                                        }
                                    }
                                }}
                            >
                                Submit
                            </button>
                            {errorMessage && (
                                <div className="error">{errorMessage}</div>
                            )}
                        </div>
                    </form>
                ) : i === 8 ? (
                    <form
                        onSubmit={async (e) => {
                            e.preventDefault();
                            const idField = loginIdType === "email" ? "email" : "username";
                            const idValid = loginIdType === "email" ? validEmail : validUsername;
                            touch(idField, "password");
                            if (idValid && validPassword) {
                                const result = await handleSubmit(e, "login");
                                if (result.success) {
                                    window.location.href = "/home";
                                } else {
                                    setErrorMessage(
                                        result.message || "Invalid credentials"
                                    );
                                }
                            }
                        }}
                    >
                        <div className="inputdata">
                            {loginIdType === "email" ? (
                                <>
                                    <input
                                        className={fieldClass("email", validEmail)}
                                        type="email"
                                        value={email}
                                        id="email"
                                        onChange={(e) => setEmail(e.target.value)}
                                        onBlur={() => touch("email")}
                                        placeholder="Email"
                                        autoComplete="off"
                                        aria-invalid={fieldAriaInvalid("email", validEmail)}
                                        autoFocus
                                    />
                                    {showErr("email", emailError)}
                                    <br></br>
                                </>
                            ) : (
                                <>
                                    <input
                                        className={fieldClass("username", validUsername)}
                                        type="text"
                                        value={username}
                                        id="username"
                                        onChange={(e) => setUsername(e.target.value)}
                                        onBlur={() => touch("username")}
                                        placeholder="Username"
                                        autoComplete="off"
                                        aria-invalid={fieldAriaInvalid("username", validUsername)}
                                        autoFocus
                                    />
                                    {showErr("username", usernameError)}
                                    <br></br>
                                </>
                            )}
                            <div className="pass-eye-box">
                                <input
                                    className={fieldClass("password", validPassword)}
                                    type={showPassword ? "text" : "password"}
                                    id="password"
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    onBlur={() => touch("password")}
                                    placeholder="Password"
                                    aria-invalid={fieldAriaInvalid("password", validPassword)}
                                    required
                                />
                                {showPassword ? (
                                    <img
                                        className="pass-eye"
                                        src="https://cdn-icons-png.flaticon.com/128/709/709612.png"
                                        alt="show pass"
                                        title="Show Password"
                                        onClick={togglePasswordVisibility}
                                    />
                                ) : (
                                    <img
                                        className="pass-eye"
                                        src="https://cdn-icons-png.flaticon.com/128/2767/2767146.png"
                                        alt="hide pass"
                                        title="Hide Password"
                                        onClick={togglePasswordVisibility}
                                    />
                                )}
                            </div>

                            {showErr("password", passwordError)}
                            {errorMessage && (
                                <div className="error">{errorMessage}</div>
                            )}
                            <br></br>
                            <span
                                className="login-ques"
                                onClick={(e) => {
                                    e.preventDefault();
                                    setLoginIdType(
                                        loginIdType === "email" ? "username" : "email"
                                    );
                                }}
                            >
                                {loginIdType === "email"
                                    ? "Forgot email? Try using username"
                                    : "Forgot username? Try using Email"}
                            </span>
                            <br></br>
                            <span
                                className="login-ques"
                                onClick={(e) => {
                                    e.preventDefault();
                                    seti(0);
                                }}
                            >
                                New? Register now
                            </span>
                            <br></br>
                            <button type="submit">Submit</button>
                        </div>
                    </form>
                ) : i === 10 ? (
                    <form
                        onSubmit={async (e) => {
                            e.preventDefault();
                            touch("firstname", "lastname", "channelid");
                            if (validFirstname && validChannelid) {
                                const result = await handleSubmit(
                                    e,
                                    "feedback"
                                );
                                if (result.success) {
                                    window.location.href = `${
                                        reqchannelid.length > 0
                                            ? `/channel?channel_id=${reqchannelid}`
                                            : "/home"
                                    }`;
                                } else {
                                    setErrorMessage(
                                        result.message ||
                                            "Feedback submission failed"
                                    );
                                }
                            }
                        }}
                    >
                        <input
                            className={fieldClass("firstname", validFirstname)}
                            type="text"
                            value={firstname}
                            id="firstname"
                            onChange={(e) => setfirstname(e.target.value)}
                            onBlur={() => touch("firstname")}
                            placeholder="First Name"
                            autoComplete="off"
                            aria-invalid={fieldAriaInvalid("firstname", validFirstname)}
                            required
                            autoFocus
                        />
                        {showErr("firstname", firstnameError)}

                        <input
                            className={fieldClass("lastname", validLastname)}
                            type="text"
                            value={lastname}
                            id="lastname"
                            autoComplete="off"
                            onChange={(e) => setlastname(e.target.value)}
                            onBlur={() => touch("lastname")}
                            placeholder="Last Name (Optional)"
                            aria-invalid={fieldAriaInvalid("lastname", validLastname)}
                        />
                        {showErr("lastname", lastnameError)}
                        <div className="inputdata">
                            <textarea
                                className="valid"
                                value={feedback}
                                id="feedback"
                                onChange={(e) => setFeedback(e.target.value)}
                                placeholder="Feedback"
                                required
                            />

                            <br></br>
                            <input
                                className={fieldClass("channelid", validChannelid)}
                                type="text"
                                value={reqchannelid}
                                id="channel_id"
                                onChange={(e) =>
                                    setReqchannelid(e.target.value)
                                }
                                onBlur={() => touch("channelid")}
                                placeholder="Channel id (Optional)"
                                aria-invalid={fieldAriaInvalid("channelid", validChannelid)}
                            />
                            {showErr("channelid", channelidError)}
                            {errorMessage && (
                                <div className="error">{errorMessage}</div>
                            )}

                            <br></br>
                            <button type="submit">
                                Submit
                            </button>
                        </div>
                    </form>
                ) : (
                    <></>
                )}
            </div>
        </div>
    );
}

export default Login;
