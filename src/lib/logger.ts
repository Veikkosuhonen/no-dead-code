import chalk from 'chalk';

export const warn = (...content: any) => {
    console.log(chalk.gray(content))
}