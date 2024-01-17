import { ParsedDirectory, ParsedFile } from "./parser.js";

type TreeNode = ParsedFile | ParsedDirectory;

const walk = (tree: TreeNode, indent: number = 1) => {
    if (tree.type === "file") {
        console.log(Array(indent).join('.'), tree.name);
        return;
    } else {
        console.log(Array(indent).join('.'), tree.name);
        tree.children.forEach(child => walk(child, indent + 1));
    }
}

export const printTree = (tree: TreeNode) => {
    walk(tree);
}