# Git Gud

A package manager for leveling up your git experience.

## Usage

| Interface | Solution  |
|-----------|-----------|
| GUI       | [teaBASE] |
| CLI | `brew install pkgxdev/made/git-gud` or `pkgx mash git-gud --help` |

```sh
$ git gud --help
```

> [!WARNING]
> All addons are pretty new and may not be careful in how they integrate.
>
> Always `git gud vet <addon>` before using it.

## Supported Platforms

We support what `pkgx` supports, though some integrations are literally macOS
apps so…

## Requirements

`git` obv. Addons may also require both [`pkgx`] and/or [`brew`]. Use
[teaBASE] to get these set up.

## Contribution

We use “fork scaling”.
Fork this repo, add a new entry in addons and submit a pull request.

The YAML format is pretty self-explanatory. Read some of the files for
examples.

### Testing

```sh
$ code addons/your-addon.yaml
$ export GIT_GUD_PATH="$PWD"
$ ./src/app/ts i your-addon
```

## What’s With the Name?

The phrase “git gud” is a colloquial way of saying “get good” and is often
used in gaming communities to mockingly encourage someone to improve their
skills or adapt after struggling or failing repeatedly.

[teaBASE]: https://github.com/pkgxdev/teaBASE
[`pkgx`]: https://pkgx.sh
[`brew`]: https://brew.sh
