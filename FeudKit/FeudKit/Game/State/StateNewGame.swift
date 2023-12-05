//
//  StateNewGame.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/30/23.
//

import Foundation

public class StateNewGame: FFState {
    private var game: FamilyFeudGame
    
    internal init(game: FamilyFeudGame) {
        self.game = game
        super.init(type: FFStateType.NEW_GAME)
    }
    
    public override func initState(data: Any?) {
        self.game.reset()
        //TODO: Logger
    }
    
    public override func cleanupState() { }
}
