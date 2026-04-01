#!/usr/bin/env node
/**
 * Convert OGS Learning Hub TSX tutorial files into a single JSON file
 * for WeChat mini-program consumption.
 *
 * Usage: node scripts/convert-ogs-tutorials.js
 */

const fs = require("fs");
const path = require("path");

// ─── Configuration ──────────────────────────────────────────────────────────

const OGS_SECTIONS_DIR =
  "/tmp/ogs-repo/src/views/LearningHub/Sections";

const OUTPUT_FILE =
  "/Users/qingfengjianke/WeChatProjects/miniprogram-1/miniprogram/data/tutorials.json";

// Section definitions: directory name, ordered lesson file basenames, Chinese section name
const SECTION_DEFS = [
  {
    id: 1,
    name: "\u5165\u95e8\u77e5\u8bc6",
    dir: "Fundamentals",
    lessons: [
      "Intro",
      "SelfCapture",
      "Eyes",
      "Ko",
      "Territory",
      "EndingTheGame",
      "TheBoard",
    ],
  },
  {
    id: 2,
    name: "\u57fa\u672c\u89c4\u5219",
    dir: "BasicPrinciples",
    lessons: [
      "CountLiberties",
      "CountChains",
      "InAtari",
      "CountAtari",
      "CaptureStone",
      "CaptureChain",
      "BothAtari",
      "Escape",
      "FindEscape",
      "CreateOpening",
      "Connect",
      "Cut",
      "BPSelfCapture",
      "RealFalseEye",
      "BPKo",
      "GroupAlive",
      "TwoEyes",
      "CaptureGroup",
    ],
  },
  {
    id: 3,
    name: "\u57fa\u7840\u6280\u5de7",
    dir: "BasicSkills",
    lessons: [
      "AtariToSide",
      "AtariToStones",
      "AtariWithCut",
      "AtariCorrectSide",
      "EscapePossible",
      "MakeKo",
      "PlayDoubleAtari",
      "PreventDoubleAtari",
      "ConnectedShape",
      "BasicSkillsCut",
      "HangingConnection",
      "Ladder",
      "ShortageLiberties",
      "FalseEye",
      "LargeEye",
      "BSGroupAlive",
      "Snapback",
      "Net",
      "CountTerritory",
      "Winner",
      "CloseTerritory",
      "CompareLiberties",
      "CapturingRace",
      "CorrectSide",
      "Capture",
      "BSEscape",
      "Liberties",
      "Enclose",
      "FirstLine",
    ],
  },
  {
    id: 4,
    name: "\u521d\u5b66\u8005\u7b49\u7ea71",
    dir: "BeginnerLevel1",
    lessons: [
      "Atari",
      "EscapeFromNet",
      "CalculateEscape",
      "CalculateLadder",
      "Ladder",
      "DoubleAtari",
      "Snapback",
      "Net",
      "ChaseDown",
      "Capture1",
      "Capture2",
      "Capture3",
      "Capture4",
      "Connect",
      "Cut",
      "CancelCut",
      "Eye",
      "FalseEye",
      "CountEyes",
      "CloseTerritory",
      "ReduceTerritory",
      "CapturingRace1",
      "CapturingRace2",
      "Seki1",
      "Seki2",
      "LifeDeath1",
      "LifeDeath2",
      "LifeDeath3",
      "LifeDeath4",
      "LifeDeath5",
      "LifeDeath6",
      "LifeDeath7",
      "SerialAtari",
      "Ko",
      "GoodPlay",
      "Block",
      "Stretch",
    ],
  },
  {
    id: 5,
    name: "\u521d\u5b66\u8005\u7b49\u7ea72",
    dir: "BeginnerLevel2",
    lessons: [
      "Seki",
      "Atari",
      "ChaseDown",
      "Snapback",
      "Net",
      "Capture1",
      "Capture2",
      "Capture3",
      "ThrowIn1",
      "ThrowIn2",
      "Connect",
      "Cut1",
      "Cut2",
      "Opening",
      "Corner1",
      "Corner2",
      "Defense1",
      "Defense2",
      "Defense3",
      "Miai",
      "Eye1",
      "Eye2",
      "Eye3",
      "Endgame1",
      "Endgame2",
      "Endgame3",
      "Endgame4",
      "Endgame5",
      "LifeDeath1",
      "LifeDeath2",
      "LifeDeath3",
      "LifeDeath4",
      "LifeDeath5",
      "LifeDeath6",
      "Ko1",
      "Ko2",
      "Ko3",
      "Haengma1",
      "Haengma2",
      "Haengma3",
      "Haengma4",
      "Haengma5",
      "Shape1",
      "Shape2",
      "CapturingRace1",
      "CapturingRace2",
      "CapturingRace3",
      "CapturingRace4",
      "CapturingRace5",
    ],
  },
  {
    id: 6,
    name: "\u521d\u5b66\u8005\u7b49\u7ea73",
    dir: "BeginnerLevel3",
    lessons: [
      "Capture1",
      "Capture2",
      "Capture3",
      "Capture4",
      "Capture5",
      "Capture6",
      "Capture7",
      "Joseki1",
      "Joseki2",
      "Joseki3",
      "Joseki4",
      "Opening1",
      "Opening2",
      "Opening3",
      "Opening4",
      "Haengma1",
      "Haengma2",
      "Haengma3",
      "Haengma4",
      "Seki1",
      "Seki2",
      "Skills1",
      "Skills2",
      "Skills3",
      "Skills4",
      "Skills5",
      "Skills6",
      "Skills7",
      "Endgame1",
      "Endgame2",
      "Endgame3",
      "Endgame4",
      "Endgame5",
      "FalseEye1",
      "FalseEye2",
      "FalseEye3",
      "FalseEye4",
      "LifeDeath1",
      "LifeDeath2",
      "LifeDeath3",
      "LifeDeath4",
      "LifeDeath5",
      "LifeDeath6",
      "LifeDeath7",
      "LifeDeath8",
      "LifeDeath9",
      "LifeDeath10",
      "LifeDeath11",
      "LifeDeath12",
      "LifeDeath13",
      "LifeDeath14",
      "LifeDeath15",
      "LifeDeath16",
      "LifeDeath17",
      "LifeDeath18",
      "CapturingRace1",
      "CapturingRace2",
      "CapturingRace3",
      "CapturingRace4",
      "CapturingRace5",
      "CapturingRace6",
      "CapturingRace7",
      "CapturingRace8",
      "PreparatoryAtari1",
      "PreparatoryAtari2",
      "PreparatoryAtari3",
      "PreparatoryAtari4",
      "ConnectCut1",
      "ConnectCut2",
      "ConnectCut3",
      "ConnectCut4",
      "ConnectCut5",
      "ConnectCut6",
      "ConnectCut7",
    ],
  },
  {
    id: 7,
    name: "\u521d\u5b66\u8005\u7b49\u7ea74",
    dir: "BeginnerLevel4",
    lessons: [
      "Opening1",
      "Opening2",
      "Opening3",
      "Opening4",
      "Opening5",
      "Opening6",
      "Opening7",
      "Opening8",
      "Opening9",
      "Joseki1",
      "Joseki2",
      "Skills1",
      "Skills2",
      "Skills3",
      "Skills4",
      "Capture1",
      "Capture2",
      "Capture3",
      "Capture4",
      "Connect1",
      "Connect2",
      "Connect3",
      "Connect4",
      "Cut1",
      "Cut2",
      "CapturingRace1",
      "CapturingRace2",
      "CapturingRace3",
      "CapturingRace4",
      "CapturingRace5",
      "CapturingRace6",
      "CapturingRace7",
      "CapturingRace8",
      "CapturingRace9",
    ],
  },
];

// ─── Title translation dictionary ───────────────────────────────────────────

const TITLE_DICT = {
  "The Game of Go": "\u56f4\u68cb",
  "Self-capture": "\u81ea\u586b\uff08\u4ee5\u63d0\u5403\u81ea\u5df1\uff09",
  "Self-Capture": "\u81ea\u586b\uff08\u4ee5\u63d0\u5403\u81ea\u5df1\uff09",
  "Self Capture": "\u81ea\u586b\uff08\u4ee5\u63d0\u5403\u81ea\u5df1\uff09",
  Eyes: "\u5404\u79cd\u773c",
  Ko: "\u52ab",
  Territory: "\u7a7a",
  "End of the Game": "\u7ec8\u5c40",
  "Ending the Game": "\u7ec8\u5c40",
  "The Board": "\u68cb\u76d8",
  "Count Liberties": "\u6570\u6c14",
  "Count Chains": "\u6570\u68cb\u4e32",
  "In Atari": "\u6253\u5403",
  "Count Atari": "\u6570\u6253\u5403",
  "Capture Stone": "\u5403\u5b50",
  "Capture a Stone": "\u5403\u5b50",
  "Capture Chain": "\u5403\u68cb\u4e32",
  "Capture a Chain": "\u5403\u68cb\u4e32",
  "Both in Atari": "\u4e92\u76f8\u6253\u5403",
  Escape: "\u9003\u8dd1",
  "Find the Escape": "\u627e\u5230\u9003\u8def",
  "Create an Opening": "\u521b\u9020\u51fa\u8def",
  Connect: "\u8fde\u63a5",
  Cut: "\u5207\u65ad",
  "Real and False Eyes": "\u771f\u773c\u4e0e\u5047\u773c",
  "Group Alive": "\u6d3b\u68cb",
  "Two Eyes": "\u4e24\u773c",
  "Capture Group": "\u5403\u6389\u4e00\u7ec4\u68cb",
  "Capture a Group": "\u5403\u6389\u4e00\u7ec4\u68cb",
  "Atari to the Side": "\u5411\u8fb9\u6253\u5403",
  "Atari to Stones": "\u5411\u5b50\u6253\u5403",
  "Atari with Cut": "\u6253\u5403\u52a0\u5207\u65ad",
  "Atari Correct Side": "\u6b63\u786e\u65b9\u5411\u6253\u5403",
  "Escape Possible": "\u80fd\u5426\u9003\u8dd1",
  "Make Ko": "\u5236\u9020\u52ab",
  "Play Double Atari": "\u53cc\u6253\u5403",
  "Prevent Double Atari": "\u9632\u6b62\u53cc\u6253\u5403",
  "Connected Shape": "\u8fde\u63a5\u5f62\u72b6",
  "Hanging Connection": "\u98de",
  Ladder: "\u5f81\u5b50",
  "Shortage of Liberties": "\u6c14\u7d27",
  "False Eye": "\u5047\u773c",
  "Large Eye": "\u5927\u773c",
  Snapback: "\u5012\u6251",
  Net: "\u67b7",
  "Count Territory": "\u6570\u76ee",
  Winner: "\u80dc\u8d1f",
  "Close Territory": "\u56f4\u7a7a",
  "Compare Liberties": "\u6bd4\u6c14",
  "Capturing Race": "\u5bf9\u6740",
  "Correct Side": "\u6b63\u786e\u65b9\u5411",
  Capture: "\u5403\u5b50",
  Enclose: "\u56f4\u4f4f",
  "First Line": "\u7b2c\u4e00\u7ebf",
  Liberties: "\u6c14",
  "Chase Down": "\u8ffd\u6740",
  "Cancel Cut": "\u9632\u65ad",
  "Count Eyes": "\u6570\u773c",
  "Reduce Territory": "\u7f29\u5c0f\u5730\u76d8",
  Seki: "\u53cc\u6d3b",
  "Life and Death": "\u6b7b\u6d3b",
  "Life & Death": "\u6b7b\u6d3b",
  "Serial Atari": "\u8fde\u7eed\u6253\u5403",
  "Good Play": "\u597d\u624b",
  Block: "\u6321",
  Stretch: "\u957f",
  "Throw In": "\u6251",
  "Throw-In": "\u6251",
  Opening: "\u5e03\u5c40",
  Corner: "\u89d2",
  Defense: "\u9632\u5b88",
  Miai: "\u89c1\u5408",
  Endgame: "\u5b98\u5b50",
  Haengma: "\u884c\u68cb",
  Shape: "\u68cb\u5f62",
  Joseki: "\u5b9a\u5f0f",
  Skills: "\u6280\u5de7",
  "Preparatory Atari": "\u5148\u624b\u6253\u5403",
  "Connect and Cut": "\u8fde\u63a5\u4e0e\u5207\u65ad",
  Atari: "\u6253\u5403",
  "Escape from Net": "\u4ece\u67b6\u4e2d\u9003\u8131",
  "Calculate Escape": "\u8ba1\u7b97\u9003\u8dd1",
  "Calculate Ladder": "\u8ba1\u7b97\u5f81\u5b50",
  "Double Atari": "\u53cc\u6253\u5403",
  Eye: "\u773c",
  "Prevent two eyes": "\u7834\u773c",
  "Group alive": "\u6d3b\u68cb",
  Chains: "\u68cb\u4e32",
  "Both Atari": "\u4e92\u76f8\u6253\u5403",
  "Find Escape": "\u627e\u5230\u9003\u8def",
  "Create Opening": "\u521b\u9020\u51fa\u8def",
  "Atari To Side": "\u5411\u8fb9\u6253\u5403",
  "Play Double-Atari": "\u53cc\u6253\u5403",
  "Prevent Double-Atari": "\u9632\u6b62\u53cc\u6253\u5403",
  "Hanging connection": "\u98de",
  "Shortage Liberties": "\u6c14\u7d27",
  "Escape net": "\u4ece\u67b6\u4e2d\u9003\u8131",
  "Double-Atari": "\u53cc\u6253\u5403",
  "Make Seki": "\u505a\u53cc\u6d3b",
  "Life&Death": "\u6b7b\u6d3b",
  "Capturing race": "\u5bf9\u6740",
  Tesuji: "\u624b\u7b4b",
};

// ─── Subtext translation dictionary ─────────────────────────────────────────

const SUBTEXT_DICT = {
  "Build territory one stone at a time":
    "\u4e00\u6b21\u4e00\u679a\u68cb\u5b50\u6765\u56f4\u7a7a",
  "Do not capture your own stones":
    "\u4e0d\u8981\u5403\u6389\u81ea\u5df1\u7684\u68cb\u5b50",
  "One and two eyes": "\u4e00\u53ea\u773c\u548c\u4e24\u53ea\u773c",
  "The recapture rule": "\u7981\u6b62\u540c\u5f62\u518d\u73b0",
  "Count territory": "\u6570\u7a7a",
  "Both players pass": "\u53cc\u65b9\u90fd\u505c\u624b",
  "Corners, sides and middle":
    "\u89d2\u3001\u8fb9\u548c\u4e2d\u8179",
};

// ─── Text translation: comprehensive English-to-Chinese map ─────────────────

const TEXT_TRANSLATIONS = {
  // Fundamentals - Intro
  "The game starts with an empty board. Two players, Black and White, take turns placing stones on the board. Black starts. You can play a stone on any empty intersection, even the outer ones. Make a move to continue.":
    "\u68cb\u5c40\u5f00\u59cb\u65f6\u68cb\u76d8\u662f\u7a7a\u7684\u3002\u9ed1\u68cb\u548c\u767d\u68cb\u4e24\u4f4d\u68cb\u624b\u8f6e\u6d41\u5728\u68cb\u76d8\u4e0a\u843d\u5b50\u3002\u5f00\u5c40\u9ed1\u68cb\u5148\u4e0b\u3002\u4f60\u53ef\u4ee5\u5c06\u68cb\u5b50\u843d\u5230\u4efb\u4f55\u7a7a\u7684\u4ea4\u53c9\u70b9\u4e0a\uff0c\u5373\u4f7f\u662f\u6700\u5916\u4fa7\u7684\u4ea4\u53c9\u70b9\u3002\u843d\u5b50\u4ee5\u7ee7\u7eed\u3002",
  "Black has played the first move. Now it is White's turn. Make a move to continue.":
    "\u9ed1\u68cb\u5df2\u7ecf\u4e0b\u4e86\u7b2c\u4e00\u624b\u3002\u73b0\u5728\u8f6e\u5230\u767d\u68cb\u4e86\u3002\u843d\u5b50\u4ee5\u7ee7\u7eed\u3002",
  "The points next to a stone are called liberties. Fill one of the liberties of the black stone.":
    "\u68cb\u5b50\u65c1\u8fb9\u7684\u4ea4\u53c9\u70b9\u79f0\u4e3a\u6c14\u3002\u586b\u4e00\u4e2a\u9ed1\u68cb\u7684\u6c14\u3002",
  "A stone is captured when all its liberties are occupied by the opponent's stones. Capture the black stone by filling the last liberty of the black stone.":
    "\u5f53\u4e00\u9897\u68cb\u5b50\u7684\u6240\u6709\u6c14\u90fd\u88ab\u5bf9\u65b9\u68cb\u5b50\u5360\u636e\u65f6\uff0c\u8be5\u68cb\u5b50\u5c31\u4f1a\u88ab\u5403\u6389\u3002\u901a\u8fc7\u586b\u4e0a\u9ed1\u68cb\u7684\u6700\u540e\u4e00\u53e3\u6c14\u6765\u5403\u6389\u9ed1\u68cb\u3002",
  "Stones of the same color next to each other form a chain. Fill one of the liberties of the black chain.":
    "\u76f8\u540c\u989c\u8272\u7684\u68cb\u5b50\u76f8\u90bb\u5f62\u6210\u4e00\u4e32\u3002\u586b\u4e00\u4e2a\u9ed1\u68cb\u4e32\u7684\u6c14\u3002",
  "The black chain has only one liberty left. This is called 'atari'. Capture the black chain that is in atari.":
    "\u9ed1\u68cb\u4e32\u53ea\u5269\u4e00\u53e3\u6c14\u4e86\u3002\u8fd9\u79f0\u4e3a\u201c\u6253\u5403\u201d\u3002\u5403\u6389\u88ab\u6253\u5403\u7684\u9ed1\u68cb\u4e32\u3002",
  // Fundamentals - SelfCapture
  "White to play. Playing at A or B is called 'self-capture' (no liberties for White) and is not allowed. But playing at C is allowed, because it captures the marked stones, creating liberties for White. Capture the marked black stones.":
    "\u767d\u68cb\u5148\u884c\u3002\u4e0b\u5728A\u6216B\u79f0\u4e3a\u201c\u81ea\u586b\u201d\uff08\u767d\u68cb\u6ca1\u6709\u6c14\uff09\uff0c\u8fd9\u662f\u4e0d\u5141\u8bb8\u7684\u3002\u4f46\u4e0b\u5728C\u662f\u5141\u8bb8\u7684\uff0c\u56e0\u4e3a\u5b83\u53ef\u4ee5\u5403\u6389\u6807\u8bb0\u7684\u68cb\u5b50\uff0c\u4e3a\u767d\u68cb\u521b\u9020\u6c14\u3002\u5403\u6389\u6807\u8bb0\u7684\u9ed1\u68cb\u3002",
  "White to play. Both players are in atari. Placing a stone where you have no liberties is not allowed, unless you can capture stones. Capture one or more black stones.":
    "\u767d\u68cb\u5148\u884c\u3002\u53cc\u65b9\u90fd\u5728\u6253\u5403\u72b6\u6001\u3002\u5728\u6ca1\u6709\u6c14\u7684\u5730\u65b9\u843d\u5b50\u662f\u4e0d\u5141\u8bb8\u7684\uff0c\u9664\u975e\u4f60\u53ef\u4ee5\u5403\u6389\u5bf9\u65b9\u7684\u68cb\u5b50\u3002\u5403\u6389\u4e00\u9897\u6216\u591a\u9897\u9ed1\u68cb\u3002",
  // Fundamentals - Eyes
  "Point A is surrounded by white stones; it is called an 'eye'. Black can not play at A (self-capture). Point B is also an eye, but Black can play at B and capture. Capture the white stones.":
    "A\u70b9\u88ab\u767d\u68cb\u56f4\u4f4f\uff0c\u79f0\u4e3a\u201c\u773c\u201d\u3002\u9ed1\u68cb\u4e0d\u80fd\u4e0b\u5728A\uff08\u81ea\u586b\uff09\u3002B\u70b9\u4e5f\u662f\u4e00\u4e2a\u773c\uff0c\u4f46\u9ed1\u68cb\u53ef\u4ee5\u4e0b\u5728B\u5e76\u5403\u5b50\u3002\u5403\u6389\u767d\u68cb\u3002",
  "White has a single bigger eye of two points, but the white group is not safe. Black to play. Capture the white stones by filling the eye point by point.":
    "\u767d\u68cb\u6709\u4e00\u4e2a\u7531\u4e24\u4e2a\u70b9\u7ec4\u6210\u7684\u5927\u773c\uff0c\u4f46\u767d\u68cb\u7ec4\u5e76\u4e0d\u5b89\u5168\u3002\u9ed1\u68cb\u5148\u884c\u3002\u9010\u70b9\u586b\u773c\u5403\u6389\u767d\u68cb\u3002",
  "White has two groups of stones. One group has two eyes. The other group has a single big eye. The group with two eyes is safe and can never be captured. Black to play. Capture a white group.":
    "\u767d\u68cb\u6709\u4e24\u7ec4\u68cb\u3002\u4e00\u7ec4\u6709\u4e24\u53ea\u773c\u3002\u53e6\u4e00\u7ec4\u6709\u4e00\u4e2a\u5927\u773c\u3002\u6709\u4e24\u53ea\u773c\u7684\u7ec4\u662f\u5b89\u5168\u7684\uff0c\u6c38\u8fdc\u4e0d\u4f1a\u88ab\u5403\u6389\u3002\u9ed1\u68cb\u5148\u884c\u3002\u5403\u6389\u4e00\u7ec4\u767d\u68cb\u3002",
  "One white group has two 'real' eyes. The other group has a real eye at A and a 'false' eye at B. The false eye is not safe and can be attacked. Black to play. Capture the white group by attacking the false eye.":
    "\u4e00\u7ec4\u767d\u68cb\u6709\u4e24\u53ea\u201c\u771f\u773c\u201d\u3002\u53e6\u4e00\u7ec4\u5728A\u6709\u4e00\u53ea\u771f\u773c\uff0c\u5728B\u6709\u4e00\u53ea\u201c\u5047\u773c\u201d\u3002\u5047\u773c\u4e0d\u5b89\u5168\uff0c\u53ef\u4ee5\u88ab\u653b\u51fb\u3002\u9ed1\u68cb\u5148\u884c\u3002\u901a\u8fc7\u653b\u51fb\u5047\u773c\u5403\u6389\u767d\u68cb\u7ec4\u3002",
  // Fundamentals - Ko
  "To prevent endlessly recapturing the same space, there is a special rule called the 'Ko rule' which prevents immediately recapturing the same position. Black can capture the marked white stone. White is not allowed to recapture the black stone immediately. White has to play elsewhere first. Capture the marked stone.":
    "\u4e3a\u4e86\u9632\u6b62\u65e0\u4f11\u6b62\u5730\u5728\u540c\u4e00\u4e2a\u4f4d\u7f6e\u53cd\u590d\u63d0\u5b50\uff0c\u6709\u4e00\u6761\u7279\u6b8a\u89c4\u5219\u79f0\u4e3a\u201c\u52ab\u201d\uff0c\u7981\u6b62\u7acb\u5373\u56de\u63d0\u3002\u9ed1\u68cb\u53ef\u4ee5\u5403\u6389\u6807\u8bb0\u7684\u767d\u68cb\u3002\u767d\u68cb\u4e0d\u80fd\u7acb\u5373\u56de\u63d0\u9ed1\u68cb\u3002\u767d\u68cb\u5fc5\u987b\u5148\u5728\u522b\u5904\u4e0b\u4e00\u624b\u3002\u5403\u6389\u6807\u8bb0\u7684\u68cb\u5b50\u3002",
  "Capture the white group by exploiting the Ko rule.":
    "\u5229\u7528\u52ab\u7684\u89c4\u5219\u5403\u6389\u767d\u68cb\u7ec4\u3002",
  "Connect your black stones.":
    "\u8fde\u63a5\u4f60\u7684\u9ed1\u68cb\u3002",
  "Capture two white stones by exploiting the Ko rule.":
    "\u5229\u7528\u52ab\u7684\u89c4\u5219\u5403\u6389\u4e24\u9897\u767d\u68cb\u3002",
  "White just captured a black stone by playing 1. To move past the ko rule, find a place to play for Black where White must capture. This is called a 'ko threat'. Next, Black can capture White's marked group.":
    "\u767d\u68cb\u521a\u4e0b\u4e861\u5403\u6389\u4e86\u4e00\u9897\u9ed1\u68cb\u3002\u4e3a\u4e86\u7ed5\u8fc7\u52ab\u7684\u89c4\u5219\uff0c\u627e\u4e00\u4e2a\u9ed1\u68cb\u4e0b\u5b50\u7684\u5730\u65b9\uff0c\u8feb\u4f7f\u767d\u68cb\u5fc5\u987b\u5e94\u5bf9\u3002\u8fd9\u79f0\u4e3a\u201c\u52ab\u6750\u201d\u3002\u7136\u540e\uff0c\u9ed1\u68cb\u5c31\u53ef\u4ee5\u5403\u6389\u767d\u68cb\u6807\u8bb0\u7684\u68cb\u7ec4\u3002",
  // Fundamentals - EndingTheGame
  "You are not obliged to place a stone on the board when it is your turn. You can instead pass. When they don't think there are any more good moves to make, to end the game both players pass their turns. This game is finished. Click pass to end it.":
    "\u8f6e\u5230\u4f60\u65f6\u4f60\u4e0d\u4e00\u5b9a\u8981\u843d\u5b50\u3002\u4f60\u53ef\u4ee5\u9009\u62e9\u505c\u624b\u3002\u5f53\u53cc\u65b9\u90fd\u8ba4\u4e3a\u6ca1\u6709\u597d\u7684\u7740\u6cd5\u65f6\uff0c\u53cc\u65b9\u90fd\u505c\u624b\u6765\u7ed3\u675f\u68cb\u5c40\u3002\u8fd9\u5c40\u68cb\u5df2\u7ecf\u7ed3\u675f\u4e86\u3002\u70b9\u51fb\u505c\u624b\u6765\u7ed3\u675f\u3002",
  'After both players have passed, you enter a "Stone Removal Phase", where you can remove obviously dead stones from play. Remove the dead black stones by clicking them.':
    "\u53cc\u65b9\u90fd\u505c\u624b\u540e\uff0c\u8fdb\u5165\u201c\u63d0\u5b50\u9636\u6bb5\u201d\uff0c\u4f60\u53ef\u4ee5\u79fb\u9664\u660e\u663e\u7684\u6b7b\u5b50\u3002\u70b9\u51fb\u6b7b\u6389\u7684\u9ed1\u68cb\u6765\u79fb\u9664\u5b83\u4eec\u3002",
  "After removing the dead stones, the sizes of the black and white territories are counted. The size of the black territory is 24 points. White has 18 territory points. The captured 4 dead stones are added to this resulting in 22 points for White. So, Black has won the game. Click Finish to end the game.":
    "\u79fb\u9664\u6b7b\u5b50\u540e\uff0c\u8ba1\u7b97\u9ed1\u767d\u53cc\u65b9\u7684\u5730\u76d8\u5927\u5c0f\u3002\u9ed1\u68cb\u7684\u5730\u76d8\u662f24\u76ee\u3002\u767d\u68cb\u670918\u76ee\u7684\u5730\u76d8\u3002\u52a0\u4e0a\u5403\u6389\u76844\u9897\u6b7b\u5b50\uff0c\u767d\u68cb\u603b\u5171\u662f22\u76ee\u3002\u6240\u4ee5\uff0c\u9ed1\u68cb\u8d62\u4e86\u8fd9\u5c40\u68cb\u3002\u70b9\u51fb\u5b8c\u6210\u6765\u7ed3\u675f\u3002",
  // Fundamentals - TheBoard
  "You can play anywhere, but a good general strategy is to focus on the corners first, then sides, then the middle. Play a stone in the upper right hand corner.":
    "\u4f60\u53ef\u4ee5\u5728\u4efb\u4f55\u5730\u65b9\u4e0b\u68cb\uff0c\u4f46\u4e00\u822c\u597d\u7684\u7b56\u7565\u662f\u5148\u5360\u89d2\uff0c\u518d\u5360\u8fb9\uff0c\u6700\u540e\u662f\u4e2d\u8179\u3002\u5728\u53f3\u4e0a\u89d2\u843d\u4e00\u5b50\u3002",
  "Go can be played on any size board, but the most common are 9x9 (which you should start on), 13x13, and the most popular, 19x19. Play on the right side of the board (not in a corner).":
    "\u56f4\u68cb\u53ef\u4ee5\u5728\u4efb\u610f\u5927\u5c0f\u7684\u68cb\u76d8\u4e0a\u4e0b\uff0c\u4f46\u6700\u5e38\u89c1\u7684\u662f9x9\uff08\u5efa\u8bae\u521d\u5b66\u8005\u4f7f\u7528\uff09\u300113x13\u548c\u6700\u6d41\u884c\u768419x19\u3002\u5728\u68cb\u76d8\u53f3\u4fa7\u843d\u5b50\uff08\u4e0d\u8981\u5728\u89d2\u4e0a\uff09\u3002",
  'You will note that there are several circles on the board, these are called "Star Points". These are not particularly special, they are just useful for orienting yourself with the board. Play on a star point.':
    "\u4f60\u4f1a\u6ce8\u610f\u5230\u68cb\u76d8\u4e0a\u6709\u51e0\u4e2a\u5706\u70b9\uff0c\u8fd9\u4e9b\u79f0\u4e3a\u201c\u661f\u4f4d\u201d\u3002\u5b83\u4eec\u5e76\u4e0d\u7279\u6b8a\uff0c\u53ea\u662f\u7528\u6765\u5e2e\u52a9\u5b9a\u4f4d\u3002\u5728\u4e00\u4e2a\u661f\u4f4d\u4e0a\u843d\u5b50\u3002",
};

// ─── Load OGS official Chinese translations ─────────────────────────────────
let OGS_ZH_CATALOG = {};
try {
  const vm = require("vm");
  const zhSrc = fs.readFileSync("/tmp/ogs-zh-cn.js", "utf8");
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(zhSrc, ctx);
  OGS_ZH_CATALOG = ctx.window.ogs_locales && ctx.window.ogs_locales["zh-cn"] || {};
  console.log("Loaded OGS zh-CN catalog:", Object.keys(OGS_ZH_CATALOG).length, "entries");
} catch (e) {
  console.warn("Could not load OGS zh-CN translations:", e.message);
}

function translateText(text) {
  if (!text || typeof text !== "string") return text || "";

  // 1. OGS official translation (exact match)
  if (OGS_ZH_CATALOG[text] && OGS_ZH_CATALOG[text][0]) return OGS_ZH_CATALOG[text][0];

  // 2. Direct match from our manual dictionary
  if (TEXT_TRANSLATIONS[text]) return TEXT_TRANSLATIONS[text];

  // For short repetitive instructions, do pattern-based translation
  let t = text;

  // Common full-sentence patterns
  const patterns = [
    [/^Black to play\. Capture the marked stones?\.$/i, "\u9ed1\u68cb\u5148\u884c\u3002\u5403\u6389\u6807\u8bb0\u7684\u68cb\u5b50\u3002"],
    [/^White to play\. Capture the marked stones?\.$/i, "\u767d\u68cb\u5148\u884c\u3002\u5403\u6389\u6807\u8bb0\u7684\u68cb\u5b50\u3002"],
    [/^Black to play\. Capture stones by throwing in\.$/i, "\u9ed1\u68cb\u5148\u884c\u3002\u901a\u8fc7\u6251\u5403\u5b50\u3002"],
    [/^White to play\. Capture stones by throwing in\.$/i, "\u767d\u68cb\u5148\u884c\u3002\u901a\u8fc7\u6251\u5403\u5b50\u3002"],
    [/^Black to play\.\s*$/i, "\u9ed1\u68cb\u5148\u884c\u3002"],
    [/^White to play\.\s*$/i, "\u767d\u68cb\u5148\u884c\u3002"],
  ];

  for (const [re, replacement] of patterns) {
    if (re.test(t)) return replacement;
  }

  // Phrase-level replacements for longer texts
  t = t.replace(/\bBlack to play\b/gi, "\u9ed1\u68cb\u5148\u884c");
  t = t.replace(/\bWhite to play\b/gi, "\u767d\u68cb\u5148\u884c");
  t = t.replace(/\bCapture the marked stones?\b/gi, "\u5403\u6389\u6807\u8bb0\u7684\u68cb\u5b50");
  t = t.replace(/\bCapture the (black|white) stones?\b/gi, (m, c) =>
    c.toLowerCase() === "black" ? "\u5403\u6389\u9ed1\u68cb" : "\u5403\u6389\u767d\u68cb"
  );
  t = t.replace(/\bCapture stones?\b/gi, "\u5403\u5b50");
  t = t.replace(/\bMake a move to continue\b/gi, "\u843d\u5b50\u4ee5\u7ee7\u7eed");
  t = t.replace(/\bliberties\b/gi, "\u6c14");
  t = t.replace(/\bliberty\b/gi, "\u6c14");
  t = t.replace(/\batari\b/gi, "\u6253\u5403");
  t = t.replace(/\bcaptured\b/gi, "\u88ab\u5403\u6389");
  t = t.replace(/\bself-capture\b/gi, "\u81ea\u586b");
  t = t.replace(/\bIs it safe\b/gi, "\u662f\u5426\u5b89\u5168");
  t = t.replace(/\bsafe\b/gi, "\u5b89\u5168");
  t = t.replace(/\bterritory\b/gi, "\u5730\u76d8");
  t = t.replace(/\bko threat\b/gi, "\u52ab\u6750");
  t = t.replace(/\bko\b/gi, "\u52ab");
  t = t.replace(/\beye\b/gi, "\u773c");
  t = t.replace(/\beyes\b/gi, "\u773c");
  t = t.replace(/\bsnapback\b/gi, "\u5012\u6251");
  t = t.replace(/\bladder\b/gi, "\u5f81\u5b50");
  t = t.replace(/\bnet\b/gi, "\u67b7");
  t = t.replace(/\bseki\b/gi, "\u53cc\u6d3b");
  t = t.replace(/\bdouble \u6253\u5403\b/gi, "\u53cc\u6253\u5403");
  t = t.replace(/\bthrow-?in\b/gi, "\u6251");
  t = t.replace(/\bmiai\b/gi, "\u89c1\u5408");
  t = t.replace(/\bjoseki\b/gi, "\u5b9a\u5f0f");
  t = t.replace(/\bhaengma\b/gi, "\u884c\u68cb");
  t = t.replace(/\bchain\b/gi, "\u68cb\u4e32");
  t = t.replace(/\bchains\b/gi, "\u68cb\u4e32");
  t = t.replace(/\bstones? of the same color next to each other form a chain\b/gi,
    "\u76f8\u540c\u989c\u8272\u7684\u68cb\u5b50\u76f8\u90bb\u5f62\u6210\u4e00\u4e32");
  t = t.replace(/\bConnect your? (black|white) stones\b/gi, (m, c) =>
    c.toLowerCase() === "black" ? "\u8fde\u63a5\u4f60\u7684\u9ed1\u68cb" : "\u8fde\u63a5\u4f60\u7684\u767d\u68cb"
  );
  t = t.replace(/\bConnect your stones\b/gi, "\u8fde\u63a5\u4f60\u7684\u68cb\u5b50");
  t = t.replace(/\bConnect the (black|white) stones\b/gi, (m, c) =>
    c.toLowerCase() === "black" ? "\u8fde\u63a5\u9ed1\u68cb" : "\u8fde\u63a5\u767d\u68cb"
  );
  t = t.replace(/\bCut the (black|white) stones\b/gi, (m, c) =>
    c.toLowerCase() === "black" ? "\u5207\u65ad\u9ed1\u68cb" : "\u5207\u65ad\u767d\u68cb"
  );
  t = t.replace(/\bEscape with the? (black|white) stones?\b/gi, (m, c) =>
    c.toLowerCase() === "black" ? "\u7528\u9ed1\u68cb\u9003\u8dd1" : "\u7528\u767d\u68cb\u9003\u8dd1"
  );
  t = t.replace(/\bEscape with the? marked stones?\b/gi, "\u7528\u6807\u8bb0\u7684\u68cb\u5b50\u9003\u8dd1");
  t = t.replace(/\bFind the best move\b/gi, "\u627e\u5230\u6700\u4f73\u7740\u6cd5");
  t = t.replace(/\bPlay the correct \u6253\u5403\b/gi, "\u4e0b\u51fa\u6b63\u786e\u7684\u6253\u5403");
  t = t.replace(/\bPlay the correct atari\b/gi, "\u4e0b\u51fa\u6b63\u786e\u7684\u6253\u5403");
  t = t.replace(/\bSave the marked stones?\b/gi, "\u6551\u6d3b\u6807\u8bb0\u7684\u68cb\u5b50");
  t = t.replace(/\bKill the (black|white) (group|stones?)\b/gi, (m, c) =>
    c.toLowerCase() === "black" ? "\u6740\u6b7b\u9ed1\u68cb" : "\u6740\u6b7b\u767d\u68cb"
  );
  t = t.replace(/\bWhich (group|side) is alive\??\b/gi, "\u54ea\u4e00\u7ec4\u662f\u6d3b\u7684\uff1f");
  // Sentence-level patterns for remaining English
  t = t.replace(/\bHow many\b/gi, "有多少");
  t = t.replace(/\bWhat is the value of\b/gi, "的价值是多少");
  t = t.replace(/\bWhat is the value\b/gi, "价值是多少");
  t = t.replace(/\bCount the number of\b/gi, "数一数");
  t = t.replace(/\bCount the\b/gi, "数一数");
  t = t.replace(/\bDoes the\b/gi, "这个");
  t = t.replace(/\bhave\s+a?\b/gi, "有");
  t = t.replace(/\bNote:\s*a?\b/gi, "注意：");
  t = t.replace(/\bcounts? for two\b/gi, "算两目");
  t = t.replace(/\bcounts? for\b/gi, "算作");
  t = t.replace(/\bplaying at\b/gi, "下在");
  t = t.replace(/\bplaying\b/gi, "下");
  t = t.replace(/\bneutral\b/gi, "中立");
  t = t.replace(/\bthe game (is|has) finished\b/gi, "对局已结束");
  t = t.replace(/\bfinished\b/gi, "结束");
  t = t.replace(/\bneed\b/gi, "需要");
  t = t.replace(/\bmoves?\b/gi, "手");
  t = t.replace(/\bcapture\b/gi, "吃");
  t = t.replace(/\bcaptures?\b/gi, "吃");
  t = t.replace(/\breal\b/gi, "真");
  t = t.replace(/\bfalse\b/gi, "假");
  t = t.replace(/\bthree\b/gi, "三");
  t = t.replace(/\btwo\b/gi, "二");
  t = t.replace(/\bone\b/gi, "一");
  t = t.replace(/\bfour\b/gi, "四");
  t = t.replace(/\bfive\b/gi, "五");
  t = t.replace(/\bempty\b/gi, "空");
  t = t.replace(/\bcalled\b/gi, "称为");
  t = t.replace(/\bbetween\b/gi, "之间");
  t = t.replace(/\bgets?\b/gi, "得到");
  t = t.replace(/\blost\b/gi, "失去");
  t = t.replace(/\bpart\b/gi, "部分");
  t = t.replace(/\bthere\b/gi, "那里");
  t = t.replace(/\bthese\b/gi, "这些");
  t = t.replace(/\bthat\b/gi, "那");
  t = t.replace(/\byour\b/gi, "你的");
  t = t.replace(/\b(Yes|No)\b/g, (m) => (m === "Yes" ? "是" : "否"));
  t = t.replace(/\bblack\b/gi, "黑棋");
  t = t.replace(/\bwhite\b/gi, "白棋");
  t = t.replace(/\bstone\b/gi, "棋子");
  t = t.replace(/\bstones\b/gi, "棋子");
  t = t.replace(/\bgroup\b/gi, "棋组");
  t = t.replace(/\bgroups\b/gi, "棋组");
  t = t.replace(/\bboard\b/gi, "棋盘");
  t = t.replace(/\bcorner\b/gi, "角");
  t = t.replace(/\bside\b/gi, "边");
  t = t.replace(/\bmiddle\b/gi, "中腹");
  t = t.replace(/\bpoint\b/gi, "目");
  t = t.replace(/\bpoints\b/gi, "目");
  t = t.replace(/\bdead\b/gi, "死");
  t = t.replace(/\balive\b/gi, "活");
  t = t.replace(/\bwin\b/gi, "赢");
  t = t.replace(/\blose\b/gi, "输");
  t = t.replace(/\bpass\b/gi, "停手");
  t = t.replace(/\bis\b/gi, "是");
  t = t.replace(/\bthe\b/gi, "");
  t = t.replace(/\ba\b/gi, "");
  t = t.replace(/\ban\b/gi, "");
  t = t.replace(/\bof\b/gi, "的");
  t = t.replace(/\bin\b/gi, "在");
  t = t.replace(/\bdo\b/gi, "");
  t = t.replace(/\bor\b/gi, "或");
  t = t.replace(/\band\b/gi, "和");
  t = t.replace(/\bfor\b/gi, "对于");
  t = t.replace(/\bwith\b/gi, "用");
  t = t.replace(/\bby\b/gi, "通过");
  t = t.replace(/\bnot\b/gi, "不");
  t = t.replace(/\bcan\b/gi, "可以");
  t = t.replace(/\bwill\b/gi, "会");
  t = t.replace(/\bhas\b/gi, "有");
  t = t.replace(/\bits?\b/gi, "它");

  // Clean up double spaces
  t = t.replace(/\s{2,}/g, " ").trim();

  return t;
}

function translateTitle(title) {
  if (!title) return "";
  // OGS official
  if (OGS_ZH_CATALOG[title] && OGS_ZH_CATALOG[title][0]) return OGS_ZH_CATALOG[title][0];
  // Exact match
  if (TITLE_DICT[title]) return TITLE_DICT[title];
  // Try trimmed
  const trimmed = title.trim();
  if (TITLE_DICT[trimmed]) return TITLE_DICT[trimmed];

  // Try matching base title + number: "Capture 1" -> "吃子 1"
  const m = trimmed.match(/^(.+?)\s*(\d+)$/);
  if (m) {
    const base = m[1].trim();
    const num = m[2];
    if (TITLE_DICT[base]) return TITLE_DICT[base] + " " + num;
  }

  // Fallback: return original
  return title;
}

function translateSubtext(subtext) {
  if (!subtext) return "";
  if (OGS_ZH_CATALOG[subtext] && OGS_ZH_CATALOG[subtext][0]) return OGS_ZH_CATALOG[subtext][0];
  if (SUBTEXT_DICT[subtext]) return SUBTEXT_DICT[subtext];
  // Try translateTitle as fallback for subtexts that match titles
  const fromTitle = translateTitle(subtext);
  if (fromTitle !== subtext) return fromTitle;
  // Phrase-based
  return translateText(subtext);
}

// ─── SGF coordinate conversion ──────────────────────────────────────────────

const SGF_LETTERS = "abcdefghjklmnopqrst"; // no 'i'!

function sgfCharToNum(ch) {
  // Handle digit characters: '1'=0, '2'=1, ..., '9'=8
  if (ch >= "1" && ch <= "9") {
    return parseInt(ch) - 1;
  }
  const idx = SGF_LETTERS.indexOf(ch.toLowerCase());
  return idx;
}

/**
 * Parse a string of SGF coordinate pairs like "c3d4e5" into [[col,row],...]
 * Each pair is two characters: column letter, row letter.
 * SGF letters: a=0, b=1, ..., h=7, j=8, k=9, ...
 */
function parseSgfCoords(str) {
  if (!str || str.trim() === "" || str === '""' || str === "''") return [];
  const result = [];
  const s = str.replace(/['"]/g, "");
  for (let i = 0; i + 1 < s.length; i += 2) {
    const col = sgfCharToNum(s[i]);
    const row = sgfCharToNum(s[i + 1]);
    if (col >= 0 && row >= 0) {
      result.push([col, row]);
    }
  }
  return result;
}

/**
 * Parse a single SGF coordinate like "c3" into [col, row]
 */
function parseSingleSgfCoord(str) {
  if (!str || str.length < 2) return null;
  const col = sgfCharToNum(str[0]);
  const row = sgfCharToNum(str[1]);
  if (col >= 0 && row >= 0) return [col, row];
  return null;
}

/**
 * Parse a move tree entry. A move string like "d1e1" means:
 * play d1, then opponent auto-responds e1.
 * We split into pairs of SGF coords.
 */
function parseMoveSequence(moveStr) {
  const coords = [];
  for (let i = 0; i + 1 < moveStr.length; i += 2) {
    const col = sgfCharToNum(moveStr[i]);
    const row = sgfCharToNum(moveStr[i + 1]);
    if (col >= 0 && row >= 0) {
      coords.push([col, row]);
    }
  }
  return coords;
}

// ─── TSX file parsing ───────────────────────────────────────────────────────

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

/**
 * Extract the section-level metadata from a TSX file:
 * - section slug
 * - title
 * - subtext
 * - number of pages
 */
function parseSectionClass(content) {
  // Extract section()
  const sectionMatch = content.match(
    /static section\(\).*?return\s+["'`]([^"'`]+)["'`]/s
  );
  const slug = sectionMatch ? sectionMatch[1] : "";

  // Extract title()
  const titleMatch = content.match(
    /static title\(\).*?(?:pgettext|_)\s*\(\s*(?:"[^"]*"\s*,\s*)?["'`]([^"'`]+)["'`]/s
  );
  const title = titleMatch ? titleMatch[1] : "";

  // Extract subtext()
  const subtextMatch = content.match(
    /static subtext\(\).*?(?:pgettext|_)\s*\(\s*(?:[\s\S]*?,\s*)?["'`]([^"'`]+)["'`]/s
  );
  const subtext = subtextMatch ? subtextMatch[1] : "";

  // Count pages from the pages() method
  const pagesMatch = content.match(
    /static pages\(\).*?return\s*\[([\s\S]*?)\]/
  );
  let pageCount = 0;
  if (pagesMatch) {
    const pageList = pagesMatch[1];
    const pageNames = pageList
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.match(/^Page/));
    pageCount = pageNames.length;
  }

  return { slug, title, subtext, pageCount };
}

/**
 * Extract all Page class definitions from the TSX content.
 * Returns an array of page objects in order.
 */
function parsePages(content) {
  const pages = [];

  // Remove block comments to avoid parsing commented-out classes
  const contentNoComments = content.replace(/\/\*[\s\S]*?\*\//g, "");

  // Find all page class definitions
  const classRegex =
    /class\s+(Page\d+)\s+extends\s+LearningPage\s*\{/g;
  let classMatch;
  const classPositions = [];

  while ((classMatch = classRegex.exec(contentNoComments)) !== null) {
    // Also skip if preceded by // on the same line
    const lineStart = contentNoComments.lastIndexOf("\n", classMatch.index) + 1;
    const prefix = contentNoComments.substring(lineStart, classMatch.index).trim();
    if (prefix.startsWith("//")) continue;

    classPositions.push({
      name: classMatch[1],
      start: classMatch.index,
    });
  }

  for (let i = 0; i < classPositions.length; i++) {
    const startPos = classPositions[i].start;
    const endPos =
      i + 1 < classPositions.length
        ? classPositions[i + 1].start
        : contentNoComments.length;
    const classBody = contentNoComments.substring(startPos, endPos);

    const page = parseSinglePage(classBody);
    pages.push(page);
  }

  return pages;
}

function parseSinglePage(classBody) {
  const page = {
    text: "",
    board_size: 9,
    initial_black: [],
    initial_white: [],
    correct_moves: [],
    wrong_moves: [],
    marks: {},
    initial_player: "black",
    mode: "puzzle",
    bounds: null,
  };

  // Extract text
  page.text = extractText(classBody);

  // Extract config
  const configMatch = classBody.match(
    /config\(\)[\s\S]*?return\s*(\{[\s\S]*?\});?\s*\}/
  );
  if (configMatch) {
    parseConfig(configMatch[1], page);
  }

  // Check for phase: "finished" (multiple-choice / quiz)
  if (classBody.includes('phase: "finished"') || classBody.includes("phase: 'finished'")) {
    page.mode = "quiz";
  }

  // Check for stone removal mode
  if (classBody.includes('mode: "play"') && classBody.includes('phase: "stone removal"')) {
    page.mode = "stone_removal";
  }

  // Check for button (pass/finish pages)
  if (classBody.includes("button()")) {
    if (classBody.includes('"Pass"') || classBody.includes("'Pass'") || classBody.includes('_("Pass")')) {
      page.mode = "pass";
    } else if (classBody.includes('"Finish"') || classBody.includes("'Finish'") || classBody.includes('_("Finish")')) {
      page.mode = "finish";
    }
  }

  return page;
}

function extractText(classBody) {
  // Handle multiple-choice (React component) text
  // These have the question inside a _(...) call within the component
  if (classBody.includes("MultipleChoice") || classBody.includes("onCorrectAnswer")) {
    return extractMultipleChoiceText(classBody);
  }

  // Simple text() method: text() { return _("..."); }
  // Or: text() { return _(\n"..."\n); }
  // Match double-quoted strings (most common)
  // Allow optional trailing comma before closing paren
  const textMatchDQ = classBody.match(
    /text\(\)\s*\{[\s\S]*?return\s+_\(\s*(?:\/\/[^\n]*\n\s*)?"([\s\S]*?)"\s*,?\s*(?:\/\/[^\n]*)?\)/
  );
  if (textMatchDQ) {
    return cleanTextString(textMatchDQ[1]);
  }

  // Match single-quoted strings
  const textMatchSQ = classBody.match(
    /text\(\)\s*\{[\s\S]*?return\s+_\(\s*(?:\/\/[^\n]*\n\s*)?'([\s\S]*?)'\s*,?\s*(?:\/\/[^\n]*)?\)/
  );
  if (textMatchSQ) {
    return cleanTextString(textMatchSQ[1]);
  }

  // Try multiline template literal or concatenated strings
  const textMatch2 = classBody.match(
    /text\(\)\s*\{[\s\S]*?return\s+_\(\s*([\s\S]*?)\);\s*\}/
  );
  if (textMatch2) {
    let raw = textMatch2[1].trim();
    // Remove comments
    raw = raw.replace(/\/\/[^\n]*/g, "");
    // Extract string content from double quotes first, then single quotes
    const strMatchDQ = raw.match(/"([\s\S]*?)"/);
    if (strMatchDQ) return cleanTextString(strMatchDQ[1]);
    const strMatchSQ = raw.match(/'([\s\S]*?)'/);
    if (strMatchSQ) return cleanTextString(strMatchSQ[1]);
  }

  return "";
}

function extractMultipleChoiceText(classBody) {
  // Find the text() method body - search up to config() method
  // For MultipleChoice pages, the _() call is inside JSX within text()
  const textStart = classBody.indexOf("text()");
  const configStart = classBody.indexOf("config()");
  if (textStart < 0) return "";

  const searchArea =
    configStart > textStart
      ? classBody.substring(textStart, configStart)
      : classBody.substring(textStart);

  const texts = [];
  // Match _("...") or _('...') - must match same quote type
  // Allow optional trailing comma before closing paren
  const regex = /_\(\s*"([\s\S]*?)"\s*,?\s*\)|_\(\s*'([\s\S]*?)'\s*,?\s*\)/g;
  let match;

  while ((match = regex.exec(searchArea)) !== null) {
    const text = match[1] !== undefined ? match[1] : match[2];
    texts.push(cleanTextString(text));
  }

  // Also try to extract the correct answer value for quiz pages
  const correctMatch = searchArea.match(
    /selectedValue\s*===\s*["'](\d+)["']\s*\)\s*\{\s*props\.onCorrectAnswer/
  );

  if (texts.length > 0) {
    let result = texts[0];
    // Extract radio button options
    const optionRegex = /value=["'](\d+)["'][^>]*\n\s*\/>\s*\n\s*(\d+)/g;
    const options = [];
    let optMatch;
    while ((optMatch = optionRegex.exec(searchArea)) !== null) {
      options.push(optMatch[2]);
    }
    if (options.length > 0) {
      result += "\n" + options.join(" / ");
    }
    if (correctMatch) {
      result += "\n\u7b54\u6848: " + correctMatch[1];
    }
    return result;
  }
  return "";
}

function cleanTextString(str) {
  return str
    .replace(/\\n/g, "\n")
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .trim();
}

function parseConfig(configStr, page) {
  // Extract mode
  const modeMatch = configStr.match(/mode:\s*["'](\w+)["']/);
  if (modeMatch) page.mode = modeMatch[1];

  // Extract initial_player
  const playerMatch = configStr.match(/initial_player:\s*["'](\w+)["']/);
  if (playerMatch) page.initial_player = playerMatch[1];

  // Extract width/height
  const widthMatch = configStr.match(/width:\s*(\d+)/);
  const heightMatch = configStr.match(/height:\s*(\d+)/);
  if (widthMatch) page.board_size = parseInt(widthMatch[1]);
  if (heightMatch) {
    const h = parseInt(heightMatch[1]);
    if (h !== page.board_size) {
      // Non-square board - use the larger dimension
      page.board_size = Math.max(page.board_size, h);
    }
  }

  // Extract bounds
  const boundsMatch = configStr.match(
    /bounds:\s*\{\s*top:\s*(\d+)\s*,\s*left:\s*(\d+)\s*,\s*bottom:\s*(\d+)\s*,\s*right:\s*(\d+)\s*\}/
  );
  if (boundsMatch) {
    page.bounds = {
      top: parseInt(boundsMatch[1]),
      left: parseInt(boundsMatch[2]),
      bottom: parseInt(boundsMatch[3]),
      right: parseInt(boundsMatch[4]),
    };
  }

  // Extract initial_state
  const stateMatch = configStr.match(
    /initial_state:\s*\{([^}]*)\}/s
  );
  if (stateMatch) {
    const stateStr = stateMatch[1];
    const blackMatch = stateStr.match(/black:\s*["']([^"']*)["']/);
    const whiteMatch = stateStr.match(/white:\s*["']([^"']*)["']/);
    if (blackMatch) page.initial_black = parseSgfCoords(blackMatch[1]);
    if (whiteMatch) page.initial_white = parseSgfCoords(whiteMatch[1]);
  }

  // Extract marks
  const marksMatch = configStr.match(
    /marks:\s*\{([^}]*)\}/
  );
  if (marksMatch) {
    page.marks = parseMarks(marksMatch[1]);
  }

  // Extract move_tree (correct and wrong moves)
  const moveTreeMatch = configStr.match(
    /makePuzzleMoveTree\s*\(([\s\S]*?)\)(?:\s*,|\s*\})/
  );
  if (moveTreeMatch) {
    parseMoveTree(moveTreeMatch[1], page);
  }
}

function parseMarks(marksStr) {
  const marks = {};

  // Parse patterns like: cross: "b3d3c2c4", triangle: "e5", 1: "c3", A: "d4"
  const regex = /(\w+):\s*["']([^"']*)["']/g;
  let match;
  while ((match = regex.exec(marksStr)) !== null) {
    const key = match[1];
    const value = match[2];
    marks[key] = parseSgfCoords(value);
  }

  return marks;
}

function parseMoveTree(moveTreeStr, page) {
  // The move tree call looks like:
  // this.makePuzzleMoveTree(["b3", "d3"], ["a1", "j9"])
  // or
  // this.makePuzzleMoveTree(["b3", "d3"], ["a1", "j9"], 9, 9)

  // Extract the two arrays
  const arrayRegex = /\[([\s\S]*?)\]/g;
  const arrays = [];
  let match;
  while ((match = arrayRegex.exec(moveTreeStr)) !== null) {
    arrays.push(match[1]);
  }

  if (arrays.length >= 1) {
    page.correct_moves = parseMoveArray(arrays[0]);
  }
  if (arrays.length >= 2) {
    page.wrong_moves = parseMoveArray(arrays[1]);
  }
}

function parseMoveArray(arrayStr) {
  const moves = [];
  // Extract all quoted strings
  const regex = /["']([^"']+)["']/g;
  let match;
  while ((match = regex.exec(arrayStr)) !== null) {
    const moveStr = match[1];
    const sequence = parseMoveSequence(moveStr);
    if (sequence.length === 1) {
      moves.push(sequence[0]);
    } else if (sequence.length > 1) {
      // Multi-move sequence: store as array of coordinates
      moves.push(sequence);
    }
  }
  return moves;
}

// ─── Main processing ────────────────────────────────────────────────────────

function processFile(filePath) {
  const content = readFile(filePath);
  const sectionMeta = parseSectionClass(content);
  const pages = parsePages(content);

  // Trim to actual page count declared in pages() if we got extra
  if (sectionMeta.pageCount > 0 && pages.length > sectionMeta.pageCount) {
    pages.length = sectionMeta.pageCount;
  }

  return {
    slug: sectionMeta.slug,
    title: sectionMeta.title,
    subtext: sectionMeta.subtext,
    page_count: sectionMeta.pageCount,
    pages: pages.map((p) => ({
      text: translateText(p.text),
      board_size: p.board_size,
      initial_black: p.initial_black,
      initial_white: p.initial_white,
      correct_moves: p.correct_moves,
      wrong_moves: p.wrong_moves,
      marks: p.marks,
      initial_player: p.initial_player,
      mode: p.mode,
      ...(p.bounds ? { bounds: p.bounds } : {}),
    })),
  };
}

function main() {
  console.log("Converting OGS tutorials to JSON...\n");

  const output = { sections: [] };
  let totalPages = 0;
  let totalLessons = 0;

  for (const sectionDef of SECTION_DEFS) {
    const section = {
      id: sectionDef.id,
      name: sectionDef.name,
      lessons: [],
    };

    console.log(
      `Section ${sectionDef.id}: ${sectionDef.name} (${sectionDef.dir})`
    );

    let lessonIdx = 0;
    for (const lessonFile of sectionDef.lessons) {
      lessonIdx++;
      const filePath = path.join(
        OGS_SECTIONS_DIR,
        sectionDef.dir,
        lessonFile + ".tsx"
      );

      if (!fs.existsSync(filePath)) {
        console.error(`  WARNING: File not found: ${filePath}`);
        continue;
      }

      try {
        const lesson = processFile(filePath);
        const lessonId = `${sectionDef.id}.${lessonIdx}`;

        section.lessons.push({
          id: lessonId,
          slug: lesson.slug,
          title: translateTitle(lesson.title),
          subtext: translateSubtext(lesson.subtext),
          page_count: lesson.pages.length,
          pages: lesson.pages,
        });

        totalPages += lesson.pages.length;
        totalLessons++;

        console.log(
          `  ${lessonId} ${lessonFile}: ${lesson.pages.length} pages - "${lesson.title}" -> "${translateTitle(lesson.title)}"`
        );
      } catch (err) {
        console.error(`  ERROR processing ${filePath}: ${err.message}`);
        console.error(err.stack);
      }
    }

    output.sections.push(section);
  }

  // Ensure output directory exists
  const outDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf8");

  console.log(`\nDone!`);
  console.log(`Total sections: ${SECTION_DEFS.length}`);
  console.log(`Total lessons: ${totalLessons}`);
  console.log(`Total pages: ${totalPages}`);
  console.log(`Output: ${OUTPUT_FILE}`);
}

main();
