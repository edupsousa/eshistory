# ESHistory
Tool for extracting historical software metrics from JavaScript projects.

## Installation

Use the following command to install eshistory:

  sudo npm install -g eshistory
  
The sudo command must be used to install the package globally.

## Usage

The basic usage is pretty simple, just call eshistory and pass two arguments: (a) the GIT repository containing the project, 
(b) the output file where metrics and metadata will be saved, e.g.

  eshistory repository output.sql

### Options

The command has some options to alter the default behavior, we recommend you to take a look in the command help (--help) to
list the available options.

### Verbose usage

The verbose option (-v) will get you detailed information (on stderr) about the metrics extraction process. 
We strongly reccomend the use of this flag.
