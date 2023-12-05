//
//  StateEndGame.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/30/23.
//

import Foundation

public class StateEndGame: FFState {
    private var game: FamilyFeudGame
    
    internal init(game: FamilyFeudGame) {
        self.game = game
        super.init(type: FFStateType.END_GAME)
    }
    
    public override func initState(data: Any?) {
        _ = self.game.getWinningFamily()
        //TODO: Logger
    }
    
    public override func updateState(timeElapsed: Float) { }
    
    public override func cleanupState() { }
}
